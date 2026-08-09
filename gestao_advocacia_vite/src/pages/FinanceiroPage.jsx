import React from 'react'
import {
  CurrencyDollarIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline'
import TabHub from '../components/ui/TabHub.jsx'
import RecebimentosPage from './RecebimentosPage.jsx'
import ContratosPage from './ContratosPage.jsx'
import NotasFiscaisPage from './NotasFiscaisPage.jsx'

/**
 * Hub Financeiro: consolida Recebimentos, Contratos, Despesas e Notas Fiscais
 * num único item de menu com abas (antes eram 4 entradas soltas na sidebar).
 */
export default function FinanceiroPage() {
  const tabs = [
    {
      key: 'recebimentos',
      label: 'Recebimentos',
      icon: CurrencyDollarIcon,
      element: <RecebimentosPage />,
    },
    { key: 'contratos', label: 'Contratos', icon: DocumentTextIcon, element: <ContratosPage /> },
    {
      key: 'notas',
      label: 'Notas Fiscais',
      icon: ReceiptPercentIcon,
      element: <NotasFiscaisPage />,
    },
  ]
  return <TabHub tabs={tabs} />
}
