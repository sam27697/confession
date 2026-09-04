import { requireActiveViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { deleteAccountAction } from './actions.js'

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
      <h1>حذف الحساب</h1>

      <div className="notice notice--danger">
        <p>شو رح ينمحي</p>
        <p>اسمك، وربط حسابك بفيسبوك، وقدرتك إنك ترجع تفوت على نفس الحساب، ورابطك، يلي بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني.</p>
      </div>

      <div className="notice notice--danger">
        <p>شو بيضل</p>
        <p>
          الرسائل يلي بعتها بتضل عند الإدارة، مربوطة برقم حساب بلا اسم. الرسائل يلي وصلتك بتضل كمان. وجوابك بأي
          مصارحة متبادلة ما منقدر نشيله.
        </p>
      </div>

      <p className="notice notice--danger">حذف الحساب نهائي وما فيك ترجع عنه.</p>

      {error && ERROR_COPY[error] && <p className="notice notice--danger">{ERROR_COPY[error]}</p>}

      <form action={deleteAccountAction}>
        <label className="checkrow" htmlFor="confirm">
          <input id="confirm" type="checkbox" name="confirm" required />
          <span className="checkrow__box"></span>
          <span>فهمت شو رح ينمحي وشو بيضل، وبدي احذف حسابي نهائياً</span>
        </label>
        <button type="submit" className="btn btn--danger-solid btn--block">احذف حسابي</button>
      </form>

      <a className="btn btn--ghost" href="/inbox">رجوع بلا حذف</a>
    </div>
  )
}
