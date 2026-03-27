import { createContext, useContext, useState, useEffect } from "react"
import { translations } from "./translations"

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem("lang") || "en")

  useEffect(() => {
    localStorage.setItem("lang", lang)
  }, [lang])

  const t = (path) => {
    const keys = path.split(".")
    let current = translations[lang]
    for (const key of keys) {
      if (current[key] === undefined) return path
      current = current[key]
    }
    return current
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useTranslation = () => {
    const context = useContext(LanguageContext)
    if (!context) throw new Error("useTranslation must be used within a LanguageProvider")
    return context
}
