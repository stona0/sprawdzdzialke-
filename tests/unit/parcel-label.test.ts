import { describe, expect, it } from 'vitest'
import { describeParcelId } from '@/lib/parcel-label'

describe('describeParcelId', () => {
  it('numer i obręb z identyfikatora bez arkusza', () => {
    expect(describeParcelId('022302_2.0020.440/1')).toEqual({ numer: '440/1', obreb: '0020', arkusz: null })
  })

  it('arkusz mapy (AR_) osobno', () => {
    expect(describeParcelId('021303_4.0001.AR_18.19/9')).toEqual({ numer: '19/9', obreb: '0001', arkusz: '18' })
  })

  it('identyfikator w nieznanym formacie zostaje w całości', () => {
    expect(describeParcelId(' 123/4 ')).toEqual({ numer: '123/4', obreb: null, arkusz: null })
  })
})
