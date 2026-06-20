import { randomUUID } from 'crypto';

const letters = new Map();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'No ID provided' });
    const letter = letters.get(id);
    if (!letter) return res.status(404).json({ error: 'Letter not found or expired' });
    return res.status(200).json({ letter });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { childName, childAge, diagnosis, councilAction, parentRequest, history, localAuthority } = req.body;

  if (!childName || !childAge || !councilAction || !parentRequest) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = `You are a specialist SEND (Special Educational Needs and Disabilities) legal advocate with 20 years of experience helping families secure Education, Health and Care Plans and appropriate provision from local authorities in England.

Write a formal, legally grounded letter on behalf of a parent to their local authority. The letter must be firm, precise, and cite the correct legislation. It should be the kind of letter that makes a council's legal team sit up and take notice.

CHILD DETAILS:
- Name: ${childName}
- Age: ${childAge}
- Diagnosis/Suspected diagnosis: ${diagnosis || 'Not yet formally diagnosed'}
- Local Authority: ${localAuthority || 'the Local Authority'}

WHAT THE COUNCIL HAS DONE OR FAILED TO DO:
${councilAction}

WHAT THE PARENT IS REQUESTING:
${parentRequest}

RELEVANT HISTORY:
${history || 'No additional history provided'}

LETTER REQUIREMENTS:
- Open formally addressed to the SEND department of ${localAuthority || 'the Local Authority'}
- Cite specific sections of the Children and Families Act 2014 (particularly sections 36, 37, 42, 43, 44) as relevant
- Reference the SEND Code of Practice 2015 (particularly chapters 5, 6, 9) as relevant
- Reference the Equality Act 2010 where appropriate
- State clearly what action is required and within what timeframe (statutory timeframes where applicable)
- Include a clear statement of intent to escalate to SENDIST Tribunal if the matter is not resolved
- Tone: formal, authoritative, factual — not emotional, not aggressive
- End with a clear deadline for response (15 working days is standard)
- Do NOT use em dashes
- UK English throughout
- Sign off as "Yours faithfully" followed by "[Parent/Guardian of ${childName}]"

Write the full letter. No preamble, no explanation — just the letter itself.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    console.log('Status:', response.status, 'Response:', JSON.stringify(data).slice(0, 200));

    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });

    const letter = data?.content?.[0]?.text;
    if (!letter) return res.status(500).json({ error: 'No letter generated' });

    const id = randomUUID();
    letters.set(id, letter);
    setTimeout(() => letters.delete(id), 24 * 60 * 60 * 1000);

    return res.status(200).json({ letter, id });

  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: err.message });
  }
}
