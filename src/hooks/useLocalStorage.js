import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook de persistencia em localStorage com sincronizacao entre abas.
 */
export function useLocalStorage(key, initialValue) {
  const resolveInitial = () =>
    typeof initialValue === 'function' ? initialValue() : initialValue

  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : resolveInitial()
    } catch (error) {
      console.warn(`[useLocalStorage] Falha ao ler "${key}":`, error)
      return resolveInitial()
    }
  })

  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(storedValue))
    } catch (error) {
      console.warn(`[useLocalStorage] Falha ao gravar "${keyRef.current}":`, error)
    }
  }, [storedValue])

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== keyRef.current || event.newValue == null) return
      try {
        setStoredValue(JSON.parse(event.newValue))
      } catch {
        /* ignora payload invalido */
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const setValue = useCallback((value) => {
    setStoredValue((prev) => (typeof value === 'function' ? value(prev) : value))
  }, [])

  return [storedValue, setValue]
}
