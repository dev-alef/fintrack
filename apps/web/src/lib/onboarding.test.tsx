import {describe,it,expect} from 'vitest'
import {localConversationReply} from './onboarding'
describe('Respostas locais na conversa',()=>{
  it('distingue ausência declarada, desconhecido e zero explícito',()=>{
    expect(localConversationReply('card','Não tenho cartões.')).toBe('absent')
    expect(localConversationReply('card','Ainda não sei')).toBe('skip')
    expect(localConversationReply('config','não tenho')).toBeNull()
    expect(localConversationReply('config','0')).toBeNull()
  })
  it('não converte uma frase com informações adicionais ou outro bloco em ausência',()=>{
    expect(localConversationReply('card','Não tenho cartões, mas devo para Ana')).toBeNull()
    expect(localConversationReply('bill','não tenho cartões')).toBeNull()
    expect(localConversationReply('loan','não devo')).toBeNull()
  })
})
