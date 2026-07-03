import * as genai from "@google/genai";
const ai = new genai.GoogleGenAI({ apiKey: "fake-key" });
console.log(Object.getOwnPropertyNames(ai.models));
