import { prependRootUrl } from './prependRootUrl'

describe('prependRootUrl', () => {
  it('mounts a root-relative URL under the prefix', () => {
    chai
      .expect(prependRootUrl('/api/v2/assets/', 'https://kf.example.org/kpi'))
      .to.equal('https://kf.example.org/kpi/api/v2/assets/')
  })

  it('mounts a root-relative URL at the origin on an unprefixed instance', () => {
    chai
      .expect(prependRootUrl('/api/v2/assets/', 'https://kf.example.org'))
      .to.equal('https://kf.example.org/api/v2/assets/')
  })

  it('leaves an absolute URL alone', () => {
    chai
      .expect(prependRootUrl('https://kf.example.org/kpi/api/v2/assets/', 'https://kf.example.org/kpi'))
      .to.equal('https://kf.example.org/kpi/api/v2/assets/')
  })
})
