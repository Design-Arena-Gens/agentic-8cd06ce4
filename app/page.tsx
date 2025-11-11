import { AgentCall } from "@/components/AgentCall";

export default function HomePage() {
  return (
    <main>
      <div className="container">
        <h1>AI Calling Agent</h1>
        <p>
          Launch an AI-driven concierge experience that sounds like a real phone conversation, captures
          structured information, and keeps a full transcript in real time.
        </p>
        <AgentCall />
      </div>
    </main>
  );
}
