import { describe, expect, it } from 'vitest'
import { resolveContainerLaunch } from './launch'

describe('Curious Reader launch lookup', () => {
  it('selects only the approved installed language', () => {
    expect(resolveContainerLaunch('?cr_lang=english&cr_user_id=opaque')).toEqual({
      language: 'english',
      deckUrl: './lang/english/deck.json',
    })
  })

  it.each([
    '',
    '?cr_lang=unsupported',
    '?cr_lang=english&cr_lang=english',
    '?cr_lang=unsupported&cr_lang=english',
  ])('does not select content for an invalid launch query: %s', (search) => {
    expect(resolveContainerLaunch(search)).toBeNull()
  })
})
