import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser } from '@/api/auth'
import { getErrorMessage } from '@/api/http'
import { useAuth } from '@/features/auth/useAuth'

function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [form, setForm] = useState({
    userId: '',
    password: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const successMessage = location.state?.message ?? ''

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const user = await loginUser(form)
      signIn(user)
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, '로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-header">
          <h1>로그인</h1>
          <p>아이디와 비밀번호를 입력해 로그인합니다.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {successMessage ? (
            <div className="feedback feedback-success">{successMessage}</div>
          ) : null}

          {errorMessage ? (
            <div className="feedback feedback-error">{errorMessage}</div>
          ) : null}

          <div className="field-group">
            <label htmlFor="userId">아이디</label>
            <input
              autoComplete="username"
              id="userId"
              name="userId"
              onChange={handleChange}
              required
              value={form.userId}
            />
          </div>

          <div className="field-group">
            <label htmlFor="password">비밀번호</label>
            <input
              autoComplete="current-password"
              id="password"
              name="password"
              onChange={handleChange}
              required
              type="password"
              value={form.password}
            />
          </div>

          <div className="form-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </div>
        </form>

        <div className="form-footer">
          <span>아직 계정이 없나요?</span>
          <Link className="text-button" to="/signup">
            회원가입
          </Link>
        </div>
      </section>
    </div>
  )
}

export default LoginPage
