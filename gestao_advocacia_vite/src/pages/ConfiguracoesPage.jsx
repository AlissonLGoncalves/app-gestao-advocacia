import React from 'react'
import { Cog6ToothIcon, PuzzlePieceIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import TabHub from '../components/ui/TabHub.jsx'
import SettingsPage from './SettingsPage.jsx'
import IntegracoesPage from './IntegracoesPage.jsx'
import PerfilPage from './PerfilPage.jsx'

/**
 * Hub Configurações: agrupa as telas que o advogado quase nunca abre
 * (Configurações do escritório, Integrações e Meu perfil) numa única entrada
 * de menu — tirando-as do caminho diário.
 */
export default function ConfiguracoesPage() {
  const tabs = [
    { key: 'geral', label: 'Escritório', icon: Cog6ToothIcon, element: <SettingsPage /> },
    {
      key: 'integracoes',
      label: 'Integrações',
      icon: PuzzlePieceIcon,
      element: <IntegracoesPage />,
    },
    { key: 'perfil', label: 'Meu perfil', icon: UserCircleIcon, element: <PerfilPage /> },
  ]
  return <TabHub tabs={tabs} />
}
