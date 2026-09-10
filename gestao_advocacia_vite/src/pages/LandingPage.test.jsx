import React from 'react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import LandingPage from './LandingPage.jsx'

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  )
}

describe('LandingPage', () => {
  it('tem um único h1 e as seções na hierarquia correta', () => {
    const { container } = renderLanding()

    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(/intimações de todos os seus tribunais/i)

    // Não pode haver h3 sem h2 antes: as seções abrem com h2.
    const niveis = [...container.querySelectorAll('h1,h2,h3')].map((el) =>
      Number(el.tagName.slice(1))
    )
    niveis.reduce((anterior, atual) => {
      expect(atual - anterior).toBeLessThanOrEqual(1)
      return atual
    }, 0)

    for (const id of ['como-funciona', 'recursos', 'seguranca', 'perguntas']) {
      expect(container.querySelector(`#${id}`)).toBeTruthy()
    }
  })

  it('a chamada para ação é solicitar acesso, não teste grátis', () => {
    renderLanding()

    const ctas = screen.getAllByRole('link', { name: /solicitar acesso/i })
    expect(ctas.length).toBeGreaterThanOrEqual(2)
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('href', '/solicitar-acesso')
    }

    expect(screen.getAllByRole('link', { name: /^entrar$/i })[0]).toHaveAttribute('href', '/login')
  })

  it('diz que o prazo é sugerido e precisa de validação', () => {
    const { container } = renderLanding()
    const texto = container.textContent

    expect(texto).toMatch(/dias corridos/i)
    expect(texto).toMatch(/valid/i)
    // Não pode prometer contagem em dias úteis/feriados: o cálculo não faz isso.
    expect(texto).not.toMatch(/dias úteis e feriados/i)
  })

  it('qualifica a emissão de NFS-e em vez de prometê-la pronta', () => {
    const { container } = renderLanding()
    expect(container.textContent).toMatch(/simulação/i)
  })

  // Guarda da regra do projeto: nada de dado inventado na landing.
  // Se alguém reintroduzir preço, métrica ou depoimento, este teste quebra.
  it('não exibe preço, métrica de resultado, depoimento nem selo', () => {
    const { container } = renderLanding()
    const texto = container.textContent

    const proibidos = [
      /R\$\s?\d/, // preço
      /\d+\s?%/, // métrica percentual
      /\d+(?:[.,]\d+)?x\s+(?:mais|menos)/i, // "4.2x mais produtividade"
      /teste (?:grátis|gratuito)/i,
      /sem cartão de crédito/i,
      /cancele quando quiser/i,
      /mais escolhido/i,
      /\d+\s*(?:dias|meses)\s+gr[áa]tis/i,
      /\bplano\s+(?:solo|pro|enterprise|banca)/i,
      /\bavalia(?:ção|ções)\b|\bestrelas?\b/i,
      /\bdepoimentos?\b/i,
      /\+\s?\d[\d.]*\s+(?:bancas|escritórios|advogados|clientes)/i,
      /\bISO\s?\d/i,
      /\bSLA\b/,
      /\bwhatsapp\b/i, // integração inexistente
      /\bcertificado ICP-Brasil audit\b/i,
    ]

    for (const padrao of proibidos) {
      expect(texto, `conteúdo proibido na landing: ${padrao}`).not.toMatch(padrao)
    }
  })

  it('a reprodução da tela não mostra número de processo nem imagem externa', () => {
    const { container } = renderLanding()

    // Nenhum número CNJ fabricado (0000000-00.0000.0.00.0000).
    expect(container.textContent).not.toMatch(/\d{7}-\d{2}\.\d{4}/)

    // A landing não carrega imagem nenhuma (nem banco de imagens externo).
    expect(container.querySelectorAll('img')).toHaveLength(0)

    // Rótulos reais da tela de Intimações continuam sendo reproduzidos.
    expect(container.textContent).toMatch(/Caixa de entrada/)
    expect(container.textContent).toMatch(/OABs monitoradas/)
    expect(container.textContent).toMatch(/Não tratadas/)
  })

  it('não promete substituir o sistema do tribunal', () => {
    const { container } = renderLanding()
    expect(container.textContent).toMatch(/peticionamento continua sendo feito no sistema do/i)
  })
})
