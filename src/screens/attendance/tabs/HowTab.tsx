import { Assumption, Card, DetailRow, Label } from '@/components/ui'
import { SITES } from '@/data/people'

export function HowTab() {
  return (
    <div className="two">
      <Card padded>
        <Label>Sites and the geofence</Label>
        {SITES.map((x) => (
          <DetailRow
            key={x.k}
            padding="8px 0"
            labelClass=""
            label={
              <>
                <b>{x.n}</b>
                <div className="gr" style={{ fontSize: 'var(--t-label)' }}>
                  {x.lat}, {x.lng}
                </div>
              </>
            }
            value={<b className="mono">{x.radius} m</b>}
          />
        ))}
        <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
          A check-in outside every radius is still recorded — it is marked as away from site rather
          than refused. Refusing it would mean someone at a courthouse cannot start their day.
        </p>
      </Card>
      <Card padded>
        <Label>Face recognition</Label>
        <Assumption title="Not built, and not something to fake">
          A browser can ask where a device is, and that is real above. It cannot tell you{' '}
          <b>whose face</b> this is without a camera, a model and somewhere to keep a biometric
          template. Biometrics are also a different legal category from a punch time — under India’s
          data protection law they need explicit consent, a stated purpose and a retention limit.{' '}
          <b>This is worth building properly with someone who knows that Act, or buying from a vendor
          who has.</b> A mock here would suggest a control that does not exist.
        </Assumption>
        <p className="gr" style={{ fontSize: 'var(--t-small)' }}>
          What the geofence does give you: the check-in records the device location and its accuracy,
          and flags anything outside the site radius.
        </p>
      </Card>
    </div>
  )
}
