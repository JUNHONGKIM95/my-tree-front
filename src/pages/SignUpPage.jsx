import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUpUser } from '@/api/auth'
import { getErrorMessage } from '@/api/http'

function SignUpPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    userId: '',
    password: '',
    confirmPassword: '',
    name: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordsDoNotMatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword

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

    if (form.password !== form.confirmPassword) {
      setErrorMessage('비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setIsSubmitting(true)

    try {
      await signUpUser({
        userId: form.userId,
        password: form.password,
        name: form.name,
      })
      navigate('/login', {
        replace: true,
        state: { message: '회원가입이 완료되었습니다. 로그인해 주세요.' },
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '회원가입에 실패했습니다. 입력값을 확인해 주세요.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-header">
          <h1>회원가입</h1>
          <p>아이디, 비밀번호, 이름을 입력해 계정을 생성합니다.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
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
              autoComplete="new-password"
              id="password"
              name="password"
              onChange={handleChange}
              required
              type="password"
              value={form.password}
            />
          </div>

          <div className="field-group">
            <label htmlFor="confirmPassword">비밀번호 확인</label>
            <input
              autoComplete="new-password"
              id="confirmPassword"
              name="confirmPassword"
              onChange={handleChange}
              required
              type="password"
              value={form.confirmPassword}
            />
            {passwordsDoNotMatch ? (
              <div className="feedback feedback-error">
                비밀번호와 비밀번호 확인이 일치하지 않습니다.
              </div>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="name">이름</label>
            <input
              autoComplete="name"
              id="name"
              name="name"
              onChange={handleChange}
              required
              value={form.name}
            />
          </div>

          <div className="form-actions">
            <button
              className="primary-button"
              disabled={isSubmitting || passwordsDoNotMatch}
              type="submit"
            >
              {isSubmitting ? '가입 중...' : '회원가입'}
            </button>
          </div>
        </form>

        <div className="form-footer">
          <span>이미 계정이 있나요?</span>
          <Link className="text-button" to="/login">
            로그인
          </Link>
        </div>
      </section>
    </div>
  )
}

export default SignUpPage
