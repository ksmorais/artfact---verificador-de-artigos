import { collection, doc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { type SavedArticle, validSavedArticle } from './historyRecord.ts'

/** Firestore deve ter regras que restrinjam users/{uid}/analyses ao próprio uid. */
export async function loadHistory(uid: string): Promise<SavedArticle[]> {
  const items = await getDocs(query(collection(db, 'users', uid, 'analyses'), orderBy('savedAt', 'desc'), limit(50)))
  return items.docs.map(item => item.data()).filter(validSavedArticle)
}
export function saveHistory(uid: string, article: SavedArticle): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'analyses', article.analysisId), article)
}
