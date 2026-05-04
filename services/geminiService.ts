
import { GoogleGenAI, Type } from "@google/genai";
import { TableData, LaravelColumnType, AiSettings } from "../types";

// Helper to generate a random ID
const generateId = () => Math.random().toString(36).substr(2, 9);

const SCHEMA_RESPONSE_TYPE = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Snake case table name (e.g., user_profiles)" },
        description: { type: Type.STRING, description: "Table comment/description" },
        columns: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING, description: "Laravel migration type (string, integer, foreignId, etc)" },
              nullable: { type: Type.BOOLEAN },
              unique: { type: Type.BOOLEAN },
              is_foreign_key: { type: Type.BOOLEAN },
              related_table: { type: Type.STRING, description: "If foreign key, which table it points to" }
            },
            required: ["name", "type"],
          },
        },
      },
      required: ["name", "columns"],
    },
};

export const suggestSchema = async (prompt: string, settings: AiSettings): Promise<TableData[]> => {
  if (settings.model === 'chrome-builtin') {
      // @ts-ignore
      if (!window.ai || !window.ai.languageModel) {
          throw new Error("Chrome Built-in AI is not available in this browser. Please enable chrome://flags/#prompt-api-for-gemini-nano");
      }
      try {
          // @ts-ignore
          const session = await window.ai.languageModel.create({
              systemPrompt: "You are a Laravel Schema Architect. Return ONLY valid JSON array of table objects."
          });
          
          const fullPrompt = `
            Task: Design a normalized database schema based on: "${prompt}".
            Target: ${settings.database}.
            
            Format:
            [
              {
                "name": "table_name",
                "description": "...",
                "columns": [
                  { "name": "...", "type": "...", "nullable": boolean, "unique": boolean, "is_foreign_key": boolean, "related_table": "..." }
                ]
              }
            ]
            
            Rules:
            1. Use snake_case for names.
            2. Infer relationships.
            3. Return ONLY JSON. No markdown.
          `;
          
          // @ts-ignore
          const result = await session.prompt(fullPrompt);
          const cleanJson = result.replace(/```json|```/g, '').trim();
          const rawTables = JSON.parse(cleanJson);
          return processRawTables(rawTables);
      } catch (e) {
          console.error("Chrome AI Error:", e);
          throw new Error("Failed to generate with Chrome Built-in AI. Ensure the model is downloaded.");
      }
  }

  if (!process.env.API_KEY) throw new Error("Gemini API Key is missing.");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are a Senior Laravel Database Architect (Laravel 11, PHP 8.2+).
    Target Database: ${settings.database}.
    
    Task: Design a normalized database schema based on the user's requirements.
    
    Strict Rules:
    1. Use 'snake_case' for table and column names. Table names must be PLURAL.
    2. Always include 'id' (primary key) implicitly.
    3. Use 'foreignId' for relationships. Detect relationships automatically (e.g., user_id -> users).
    4. For polymorphic relations, suggest a 'morphs' type column.
    5. Optimize data types (use 'tinyInteger' for small enums, 'json' for flexible data, 'ulid' if distributed).
    6. If a relationship is Many-to-Many, create the Pivot Table explicitly (e.g., role_user).
    
    Return ONLY valid JSON data matching the schema.
  `;

  const response = await ai.models.generateContent({
    model: settings.model,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: SCHEMA_RESPONSE_TYPE,
      temperature: settings.temperature,
      topP: settings.topP,
      topK: settings.topK,
    },
  });

  const rawTables = JSON.parse(response.text || "[]");
  return processRawTables(rawTables);
};

export const suggestSchemaFromJson = async (reqJson: string, resJson: string, settings: AiSettings): Promise<TableData[]> => {
    if (settings.model === 'chrome-builtin') {
         // @ts-ignore
        if (!window.ai || !window.ai.languageModel) {
            throw new Error("Chrome Built-in AI is not available.");
        }
        // @ts-ignore
        const session = await window.ai.languageModel.create();
        const prompt = `Reverse engineer this JSON into a Laravel Schema JSON structure:\nRequest: ${reqJson}\nResponse: ${resJson}`;
        // @ts-ignore
        const result = await session.prompt(prompt);
        // Basic cleanup, though window.ai output can be unpredictable without structured output support
        const cleanJson = result.replace(/```json|```/g, '').trim(); 
        try {
            return processRawTables(JSON.parse(cleanJson));
        } catch(e) {
            throw new Error("Chrome AI output was not valid JSON.");
        }
    }

    if (!process.env.API_KEY) throw new Error("API Key missing");
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
    Reverse Engineer a Database Schema from this API interaction.
    
    REQUEST PAYLOAD:
    ${reqJson}
    
    RESPONSE PAYLOAD:
    ${resJson}
    
    1. Identify entities.
    2. Normalize nested objects into separate tables.
    3. Infer relationships (1:1, 1:N, N:M).
    4. Infer column types based on value examples.
    `;

    const systemInstruction = `
    You are an API Integration Specialist and Database Expert.
    Convert JSON payloads into a normalized Laravel 11 Schema.
    Target Database: ${settings.database}.
    Ensure all tables have primary keys and proper foreign keys.
    `;

    const response = await ai.models.generateContent({
        model: settings.model,
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: SCHEMA_RESPONSE_TYPE,
            temperature: settings.temperature,
            topP: settings.topP,
            topK: settings.topK,
        }
    });

    const rawTables = JSON.parse(response.text || "[]");
    return processRawTables(rawTables);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processRawTables = (rawTables: any[]): TableData[] => {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawTables.map((t: any) => ({
    name: t.name,
    comment: t.description,
    columns: [
      { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...t.columns.map((c: any) => ({
        id: generateId(),
        name: c.name,
        type: c.type,
        nullable: c.nullable || false,
        unique: c.unique || false,
        comment: c.is_foreign_key ? `FK to ${c.related_table}` : undefined
      })),
    ],
    softDeletes: false,
    timestamps: true,
    color: '#eef2ff', 
  }));
}
