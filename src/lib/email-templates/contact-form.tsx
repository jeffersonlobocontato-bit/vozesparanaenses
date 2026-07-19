import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  subject?: string
  message?: string
  department?: string
}

const departmentLabels: Record<string, string> = {
  redacao: 'Redação',
  publicidade: 'Publicidade',
  privacidade: 'Privacidade / LGPD',
  geral: 'Geral',
}

const Email = ({ name, email, subject, message, department }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo contato pelo site Vozes Paranaenses</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Novo contato pelo site</Heading>
        <Section style={section}>
          <Text style={label}>Nome</Text>
          <Text style={value}>{name || 'Não informado'}</Text>

          <Text style={label}>E-mail</Text>
          <Text style={value}>{email || 'Não informado'}</Text>

          <Text style={label}>Assunto</Text>
          <Text style={value}>{subject || 'Não informado'}</Text>

          <Text style={label}>Departamento</Text>
          <Text style={value}>{department ? departmentLabels[department] || department : 'Geral'}</Text>

          <Text style={label}>Mensagem</Text>
          <Text style={messageValue}>{message || '(sem mensagem)'}</Text>
        </Section>
        <Text style={footer}>
          Enviado pelo formulário de contato de Vozes Paranaenses.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Novo contato: {subject}',
  displayName: 'Formulário de Contato',
  previewData: {
    name: 'João da Silva',
    email: 'joao@exemplo.com',
    subject: 'Sugestão de pauta',
    message: 'Gostaria de sugerir uma matéria sobre obras na região.',
    department: 'redacao',
  },
  to: 'contato@vozesparanaenses.com.br',
} satisfies TemplateEntry

const main = {
  backgroundColor: '#f8fafc',
  fontFamily: '"Barlow", Arial, sans-serif',
  padding: '20px 0',
}

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '32px',
  maxWidth: '600px',
  margin: '0 auto',
}

const heading = {
  color: '#0A2540',
  fontFamily: '"Bebas Neue", Arial, sans-serif',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 24px',
}

const section = {
  marginTop: '16px',
}

const label = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 'bold',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '16px 0 4px',
}

const value = {
  color: '#0f172a',
  fontSize: '16px',
  margin: '0 0 12px',
}

const messageValue = {
  ...value,
  whiteSpace: 'pre-wrap' as const,
  lineHeight: '1.5',
}

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  marginTop: '32px',
  textAlign: 'center' as const,
}
