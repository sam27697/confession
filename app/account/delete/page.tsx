import { requireActiveViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { deleteAccountAction } from './actions.js'
import { SubmitButton } from '../../_components/SubmitButton.js'

const ERROR_COPY: Record<string, string> = {
  required: 'لازم تحط إشارة عالمربع تحت قبل ما تأكد الحذف.',
  generic: 'صار في مشكلة، جرب لاحقاً.',
}

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const db = getDb()
  await requireActiveViewerAccountId(db)
  const { error } = await searchParams

  return (
    <div>
      <nav className="view-breadcrumb" aria-label="مسار التنقل">
        <a href="/inbox" className="view-breadcrumb__link" aria-label="الرجوع للصندوق">
          <span aria-hidden="true">→</span>
          <span>صندوقي</span>
        </a>
      </nav>
      <h1>حذف الحساب</h1>

      <div className="sovereignty-card">
        <div className="sovereignty-card__section sovereignty-card__section--purged">
          <div className="sovereignty-card__header">
            <span className="sovereignty-card__badge sovereignty-card__badge--purged">سيتم الحذف</span>
            <h2 className="sovereignty-card__title">شو رح ينمحي</h2>
          </div>
          <p className="sovereignty-card__text">اسمك، وربط حسابك بفيسبوك، وقدرتك إنك ترجع تفوت على نفس الحساب، ورابطك، يلي بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني.</p>
        </div>

        <div className="sovereignty-card__section sovereignty-card__section--preserved">
          <div className="sovereignty-card__header">
            <span className="sovereignty-card__badge sovereignty-card__badge--preserved">يبقى محفوظاً</span>
            <h2 className="sovereignty-card__title">شو بيضل</h2>
          </div>
          <p className="sovereignty-card__text">
            الرسائل يلي بعتها بتضل عند الإدارة، مربوطة برقم حساب بلا اسم. الرسائل يلي وصلتك بتضل كمان. وجوابك بأي
            مصارحة متبادلة ما منقدر نشيله.
          </p>
        </div>

        <p className="sovereignty-card__final-hint">حذف الحساب نهائي وما فيك ترجع عنه.</p>
      </div>

      <div className="sovereignty-card__actions">
        <a className="btn btn--secondary btn--block" href="/inbox">رجوع بلا حذف - احتفظ بحسابي</a>
      </div>

      {error && ERROR_COPY[error] && <p className="notice notice--danger">{ERROR_COPY[error]}</p>}

      <form action={deleteAccountAction}>
        <label className="checkrow" htmlFor="confirm">
          <input id="confirm" type="checkbox" name="confirm" required />
          <span className="checkrow__box"></span>
          <span>فهمت شو رح ينمحي وشو بيضل، وبدي احذف حسابي نهائياً</span>
        </label>
        {/* The one irreversible action in the app. Disabling the button for
            the duration of the transaction is the point here, not the
            spinner: a second click on a slow connection is a second
            deleteAccount call. */}
        <SubmitButton className="btn btn--danger-solid btn--block" loadingText="عم ينحذف...">احذف حسابي</SubmitButton>
      </form>
    </div>
  )
}
