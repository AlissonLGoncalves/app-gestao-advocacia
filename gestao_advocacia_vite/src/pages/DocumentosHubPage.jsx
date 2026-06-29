import React from 'react'
import { DocumentTextIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import TabHub from '../components/ui/TabHub.jsx'
import DocumentosPage from './DocumentosPage.jsx'
import ModelosDocumentoPage from './ModelosDocumentoPage.jsx'

/**
 * Hub Documentos: junta os arquivos do escritório (Documentos) e os Modelos
 * de peça numa só entrada de menu com abas (Modelos era item separado).
 */
export default function DocumentosHubPage() {
  const tabs = [
    { key: 'arquivos', label: 'Documentos', icon: DocumentTextIcon, element: <DocumentosPage /> },
    {
      key: 'modelos',
      label: 'Modelos',
      icon: DocumentDuplicateIcon,
      element: <ModelosDocumentoPage />,
    },
  ]
  return <TabHub tabs={tabs} />
}
