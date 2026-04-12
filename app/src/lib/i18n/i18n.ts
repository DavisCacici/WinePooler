import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import enCommon from '../../locales/en/common.json'
import enHome from '../../locales/en/home.json'
import enPallets from '../../locales/en/pallets.json'
import enBuyerDashboard from '../../locales/en/buyerDashboard.json'
import enWineryDashboard from '../../locales/en/wineryDashboard.json'
import itCommon from '../../locales/it/common.json'
import itHome from '../../locales/it/home.json'
import itPallets from '../../locales/it/pallets.json'
import itBuyerDashboard from '../../locales/it/buyerDashboard.json'
import itWineryDashboard from '../../locales/it/wineryDashboard.json'

export const defaultNamespace = 'common'
export const supportedLngs = ['en', 'it'] as const
export const namespaces = ['common', 'home', 'pallets', 'buyerDashboard', 'wineryDashboard'] as const

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    pallets: enPallets,
    buyerDashboard: enBuyerDashboard,
    wineryDashboard: enWineryDashboard,
  },
  it: {
    common: itCommon,
    home: itHome,
    pallets: itPallets,
    buyerDashboard: itBuyerDashboard,
    wineryDashboard: itWineryDashboard,
  },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: [...namespaces],
    defaultNS: defaultNamespace,
    fallbackLng: 'it',
    supportedLngs: [...supportedLngs],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'localStorage'],
      lookupQuerystring: 'lng',
      caches: ['localStorage'],
    },
  })

if (typeof document !== 'undefined') {
    console.log('Setting document language to', i18n.resolvedLanguage)
  document.documentElement.lang = i18n.resolvedLanguage ?? 'it'
  i18n.on('languageChanged', language => {
    console.log('Language changed to', language)
    document.documentElement.lang = language
  })
}

export default i18n
