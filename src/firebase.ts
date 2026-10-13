import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

const app = initializeApp({
  apiKey: 'AIzaSyBNhUUthVUIxMwVdAI_wuXIn4ozu1be99g',
  authDomain: 'ria-fakenews.firebaseapp.com',
  projectId: 'ria-fakenews',
  storageBucket: 'ria-fakenews.firebasestorage.app',
  messagingSenderId: '474105993147',
  appId: '1:474105993147:web:0af99aa3b9858e5b64969e',
})
export const auth = getAuth(app)
const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })
export const loginWithGoogle = () => signInWithPopup(auth, provider)
export const logout = () => signOut(auth)
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Você fechou a janela de login. Clique novamente para entrar.',
    'auth/cancelled-popup-request': 'Já existe uma tentativa de login em andamento.',
    'auth/popup-blocked': 'Permita pop-ups para este site e tente novamente.',
    'auth/unauthorized-domain': 'Este domínio precisa ser autorizado no Firebase Authentication.',
    'auth/operation-not-allowed': 'Ative o provedor Google no Firebase Authentication.',
    'auth/configuration-not-found': 'Configure o Firebase Authentication e ative o provedor Google.',
    'auth/network-request-failed': 'Não foi possível conectar ao Firebase. Confira sua conexão.',
    'auth/invalid-api-key': 'A configuração do Firebase não foi aceita. Confira a chave do projeto.',
    'auth/user-disabled': 'Esta conta está desativada. Entre em contato com o administrador.',
  }
  return messages[code || ''] || 'Não foi possível entrar. Tente novamente e confira a configuração do Firebase.'
}
