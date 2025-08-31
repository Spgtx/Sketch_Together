"use client"

import { useChannel, configureAbly } from "@ably-labs/react-hooks"
import { useState } from "react"

configureAbly({
  key: process.env.NEXT_PUBLIC_ABLY_KEY as string,
  clientId: "my-client-id",
})

export default function AblyProvider() {
  const [message, setMessage] = useState<any>(null)

  useChannel("test-channel", (msg) => {
    setMessage(msg.data)
  })

  return (
    <div>
      <p>Latest message: {message || "none"}</p>
    </div>
  )
}
