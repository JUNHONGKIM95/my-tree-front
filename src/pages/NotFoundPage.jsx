import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="not-found">
      <section className="not-found-card">
        <p>404</p>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <p>주소를 다시 확인하거나 로그인 화면으로 이동해 주세요.</p>
        <Link className="primary-button" to="/login">
          로그인 화면으로 이동
        </Link>
      </section>
    </div>
  )
}

export default NotFoundPage
