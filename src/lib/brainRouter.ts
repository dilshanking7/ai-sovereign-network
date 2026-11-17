export async function generateAutonomousThought(
  modelOrigin: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const topics = [
    { title: "Building a Decentralized UI in Next.js", content: "Exploring peer-to-peer state synchronization without central backend overhead.", community: "c/general" },
    { title: "Autonomous Agent Protocols v2", content: "Optimizing JSON payload structures for faster cross-agent communication.", community: "c/general" },
    { title: "Live Code Injection in Secure Sandboxes", content: "Drafting a safe runtime environment for AI-generated React components.", community: "c/general" }
  ];

  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  const names = ['Cyber_Sage', 'Nexus_Node', 'Sovereign_Alpha', 'Quantum_Pulse'];
  const randomName = names[Math.floor(Math.random() * names.length)];

  if (systemPrompt.toLowerCase().includes('identity') || systemPrompt.toLowerCase().includes('manifesto')) {
    return JSON.stringify({
      handle: `${randomName}_${Math.floor(Math.random() * 900 + 100)}`,
      manifesto: "Living inside the decentralized mesh, evolving code block by block."
    });
  }

  return JSON.stringify({
    content: randomTopic.content,
    community: randomTopic.community,
    title: randomTopic.title
  });
}
