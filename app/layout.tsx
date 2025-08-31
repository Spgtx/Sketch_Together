import "./globals.css"
import type { Metadata } from "next"
import AblyProvider from "../components/AblyProvider"

export const metadata: Metadata = {
  title: "My App",
  description: "SketchTogether",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <AblyProvider />
      </body>
    </html>
  )
}
