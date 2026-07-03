import { db, collection, addDoc, getDocs, query, orderBy, deleteDoc, writeBatch, doc, OperationType, handleFirestoreError } from "./firebase";
import appConfig from "../config.json";
import { DriveLog } from "../types";

export async function writeLog(userId: string, level: "info" | "success" | "warn" | "error", message: string, details?: string) {
  // Disabling Firestore logging to prevent "Free daily read units per project" quota exhaustion.
  // Logs will only be maintained in local React state.
  return Promise.resolve();
}

