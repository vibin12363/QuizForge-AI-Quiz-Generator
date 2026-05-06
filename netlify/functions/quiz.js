exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { text, numQ, difficulty, qtype } = JSON.parse(event.body);

    if (!text || !numQ || !difficulty || !qtype) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }
    if (text.length > 15000) {
      return { statusCode: 400, body: JSON.stringify({ error: "Text too long. Please keep it under 15,000 characters." }) };
    }
    const num = parseInt(numQ);
    if (isNaN(num) || num < 1 || num > 25) {
      return { statusCode: 400, body: JSON.stringify({ error: "Number of questions must be between 1 and 25." }) };
    }

    const typeInstruction = qtype === "truefalse"
      ? `Generate exactly ${num} True/False questions. Each options array must be exactly ["True","False"].`
      : `Generate exactly ${num} multiple choice questions with exactly 4 options each.`;

    const prompt = `You are a quiz generator. ${typeInstruction} Difficulty: ${difficulty}. Topic/Text: """${text}"""
Respond ONLY with a valid JSON array. No markdown, no extra text. No explanation outside JSON.
Format: [{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]
"answer" is the 0-based index of the correct option.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Groq API error");
    }

    const data = await response.json();
    let raw = data.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not parse quiz data. Please try again.");
    const quizData = JSON.parse(match[0]);
    if (!Array.isArray(quizData) || !quizData.length) throw new Error("Invalid quiz data received.");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ quizData })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Something went wrong" })
    };
  }
};