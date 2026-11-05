import { signOut } from 'next-auth/react'

// next-auth would send the browser to its own idea of the address, which a
// proxy can change, so the page reloads where it is instead
export default async function signOutInPlace() {
  await signOut({ redirect: false })
  window.location.reload()
}
