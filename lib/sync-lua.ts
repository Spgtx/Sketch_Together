/** Redis executes this entire change as ONE atomic script, including version checks. */
export const APPLY_SYNC_OPERATION = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({status='missing'}) end
local board = cjson.decode(raw)
local op = cjson.decode(ARGV[1])
if board.seen[op.opId] ~= nil then
  return cjson.encode({status='ok', revision=board.seen[op.opId], duplicate=true})
end
board.memberVersions = board.memberVersions or {}
board.structureVersions = board.structureVersions or {}
local boardChange = op.kind == 'clear' or op.kind == 'replace'
local memberChange = op.kind == 'modify-member'
local previous = -1
if op.id and board.versions[op.id] ~= nil then
  previous = board.versions[op.id]
end
local memberKey = tostring(op.id or '') .. ':' .. tostring(op.memberId or '')
local memberPrevious = board.memberVersions[memberKey] or -1
local structurePrevious = board.structureVersions[op.id or ''] or previous
local memberPosition = nil
if memberChange then
  local parent = board.objects[op.id]
  if not parent or type(parent.objects) ~= 'table' then
    return cjson.encode({status='conflict', revision=board.revision})
  end
  for i, item in ipairs(parent.objects) do
    if item.id == op.memberId then memberPosition = i break end
  end
  if not memberPosition then
    return cjson.encode({status='conflict', revision=board.revision})
  end
end
if board.policy ~= 'classic' then
  if boardChange and tonumber(op.baseRevision) ~= tonumber(board.revision) then
    return cjson.encode({status='conflict', revision=board.revision})
  end
  if memberChange and (tonumber(op.baseVersion) ~= tonumber(structurePrevious)
    or tonumber(op.baseMemberVersion) ~= tonumber(memberPrevious)) then
    return cjson.encode({status='conflict', revision=board.revision})
  end
  if not boardChange and not memberChange and
    tonumber(op.baseVersion) ~= tonumber(previous) then
    return cjson.encode({status='conflict', revision=board.revision})
  end
end
board.revision = board.revision + 1
board.updatedAt = tonumber(ARGV[2])
if boardChange then
  for id, _ in pairs(board.objects) do
    board.versions[id] = board.revision
    board.structureVersions[id] = board.revision
  end
  board.objects = {}
  if op.kind == 'replace' then
    for _, object in pairs(op.state.objects) do
      board.objects[object.id] = object
      board.versions[object.id] = board.revision
      board.structureVersions[object.id] = board.revision
    end
  end
elseif memberChange then
  if board.structureVersions[op.id] == nil then
    board.structureVersions[op.id] = structurePrevious
  end
  board.objects[op.id].objects[memberPosition] = op.member
  board.memberVersions[memberKey] = board.revision
  board.versions[op.id] = board.revision
elseif op.kind == 'remove' then
  board.objects[op.id] = nil
  board.versions[op.id] = board.revision
  board.structureVersions[op.id] = board.revision
else
  board.objects[op.id] = op.object
  board.versions[op.id] = board.revision
  board.structureVersions[op.id] = board.revision
end
board.seen[op.opId] = board.revision
table.insert(board.recent, op.opId)
if #board.recent > 160 then
  local removed = table.remove(board.recent, 1)
  board.seen[removed] = nil
end
local encoded = cjson.encode(board)
if string.len(encoded) > 4500000 then
  return cjson.encode({status='too_large'})
end
redis.call('SET', KEYS[1], encoded)
redis.call('ZADD', KEYS[2], board.updatedAt, ARGV[3])
return cjson.encode({status='ok', revision=board.revision})
`;
