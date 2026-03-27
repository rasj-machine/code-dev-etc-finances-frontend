import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(valueCents) {
  const settings = JSON.parse(localStorage.getItem('user_settings') || '{}')
  return new Intl.NumberFormat(settings.locale || 'pt-BR', { 
    style: 'currency', 
    currency: settings.currency || 'BRL' 
  }).format((valueCents || 0) / 100)
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatPercent(value) {
  if (value == null) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function calcProfitPercent(purchased, current) {
  if (!purchased || purchased === 0) return 0
  return ((current - purchased) / purchased) * 100
}
