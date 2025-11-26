import { GoogleGenAI, Type } from "@google/genai";
import { TableData, LaravelColumnType } from "../types";

// Helper to generate a random ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const suggestSchema = async (prompt: string): Promise<TableData[]> => {
  if (!process.env.API_KEY) {
    throw new Error("Gemini API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are an expert Laravel Database Architect.
    Your task is to generate a database schema based on the user's description.
    You must return the result as a JSON array of Table objects.
    Each Table object must have a 'name' (snake_case) and a list of 'columns'.
    Columns should have 'name', 'type' (valid Laravel migration type), 'nullable' (boolean), and 'unique' (boolean).
    Infer relationships by adding 'foreignId' type columns (e.g., user_id for users table).
    Ensure the schema follows standard Laravel conventions (id as primary key, snake_case names).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            columns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  nullable: { type: Type.BOOLEAN },
                  unique: { type: Type.BOOLEAN },
                },
                required: ["name", "type"],
              },
            },
          },
          required: ["name", "columns"],
        },
      },
    },
  });

  const rawTables = JSON.parse(response.text || "[]");

  // Post-process to ensure IDs and standard fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawTables.map((t: any) => ({
    name: t.name,
    columns: [
      { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...t.columns.map((c: any) => ({
        id: generateId(),
        name: c.name,
        type: c.type,
        nullable: c.nullable || false,
        unique: c.unique || false,
      })),
    ],
    softDeletes: false,
    timestamps: true,
    color: '#eef2ff', // Default light indigo
  }));
};
