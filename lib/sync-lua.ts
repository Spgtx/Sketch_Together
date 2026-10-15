/** Redis executes this entire change as ONE atomic script, including version checks. */
export const APPLY_SYNC_OPERATION = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({status='missing'}) end
local board = cjson.decode(raw)
local op = cjson.decode(ARGV[1])
if board.seen[op.opId] ~= nil then
  return cjson.encode({status='ok', revision=board.seen[op.opId], duplicate=true})
end
local boardChange = op.kind == 'clear' or op.kind == 'replace'
local previous = -1
if op.id and board.versions[op.id] ~= nil then
  previous = board.versions[op.id]
end
if board.policy ~= 'classic' then
  if boardChange and tonumber(op.baseRevision) ~= tonumber(board.revision) then
    return cjson.encode({status='conflict', revision=board.revision})
  end
  if not boardChange and tonumber(op.baseVersion) ~= tonumber(previous) then
    return cjson.encode({status='conflict', revision=board.revision})
  end
end
board.revision = board.revision + 1
board.updatedAt = tonumber(ARGV[2])
if boardChange then
  for id, _ in pairs(board.objects) do board.versions[id] = board.revision end
  board.objects = {}
  if op.kind == 'replace' then
    for _, object in pairs(op.state.objects) do
      board.objects[object.id] = object
      board.versions[object.id] = board.revision
    end
  end
elseif op.kind == 'remove' then
  board.objects[op.id] = nil
  board.versions[op.id] = board.revision
else
  board.objects[op.id] = op.object
  board.versions[op.id] = board.revision
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
