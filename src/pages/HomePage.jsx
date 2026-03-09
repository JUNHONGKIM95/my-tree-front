import { useEffect, useMemo, useRef, useState } from 'react'
import { createPost, deletePost, getPost, getPosts } from '@/api/posts'
import { deleteUser, getUsers } from '@/api/users'
import { getErrorMessage } from '@/api/http'
import { useAuth } from '@/features/auth/useAuth'

const ADMIN_USER_ID = 'admin'
const PLACEMENT_STORAGE_KEY = 'my-tree-post-layout-v2'

const BOARD_SLOTS = [
  { left: '6%', top: '8%' },
  { left: '29%', top: '8%' },
  { left: '52%', top: '8%' },
  { left: '75%', top: '8%' },
  { left: '6%', top: '39%' },
  { left: '29%', top: '39%' },
  { left: '52%', top: '39%' },
  { left: '75%', top: '39%' },
  { left: '6%', top: '70%' },
  { left: '29%', top: '70%' },
  { left: '52%', top: '70%' },
  { left: '75%', top: '70%' },
]

const NOTE_ROTATIONS = ['rotate(-3deg)', 'rotate(2deg)', 'rotate(-2deg)', 'rotate(3deg)']
function readStoredPlacements() {
  const storedValue = localStorage.getItem(PLACEMENT_STORAGE_KEY)

  if (!storedValue) {
    return {}
  }

  try {
    return JSON.parse(storedValue)
  } catch {
    localStorage.removeItem(PLACEMENT_STORAGE_KEY)
    return {}
  }
}

function writeStoredPlacements(placements) {
  localStorage.setItem(PLACEMENT_STORAGE_KEY, JSON.stringify(placements))
}

function hashString(value) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647
  }

  return Math.abs(hash)
}

function getAuthorColor(userId) {
  if (userId === ADMIN_USER_ID) {
    return {
      background: 'hsl(12 100% 94%)',
      pin: 'hsl(0 84% 39%)',
      outline: 'hsl(0 84% 39%)',
    }
  }

  const hue = hashString(userId) % 360
  return {
    background: `hsl(${hue} 85% 91%)`,
    pin: `hsl(${hue} 72% 36%)`,
    outline: `hsl(${hue} 72% 36%)`,
  }
}

function getPlacementOrder(placement) {
  return placement.boardIndex * BOARD_SLOTS.length + placement.slotIndex
}

function buildSequentialPlacements(postsInOrder) {
  return Object.fromEntries(
    postsInOrder.map((post, index) => [
      post.postNo,
      {
        boardIndex: Math.floor(index / BOARD_SLOTS.length),
        slotIndex: index % BOARD_SLOTS.length,
      },
    ]),
  )
}

function getSlotKey(boardIndex, slotIndex) {
  return `${boardIndex}:${slotIndex}`
}

function normalizePlacements(posts, storedPlacements) {
  const placements = {}
  const usedSlots = new Set()

  posts.forEach((post) => {
    const placement = storedPlacements[post.postNo]
    if (!placement) {
      return
    }

    const isValidBoard = Number.isInteger(placement.boardIndex) && placement.boardIndex >= 0
    const isValidSlot =
      Number.isInteger(placement.slotIndex) &&
      placement.slotIndex >= 0 &&
      placement.slotIndex < BOARD_SLOTS.length

    if (!isValidBoard || !isValidSlot) {
      return
    }

    const slotKey = getSlotKey(placement.boardIndex, placement.slotIndex)
    if (usedSlots.has(slotKey)) {
      return
    }

    usedSlots.add(slotKey)
    placements[post.postNo] = placement
  })

  posts.forEach((post) => {
    if (placements[post.postNo]) {
      return
    }

    let boardIndex = 0
    let slotIndex = 0

    while (usedSlots.has(getSlotKey(boardIndex, slotIndex))) {
      slotIndex += 1

      if (slotIndex >= BOARD_SLOTS.length) {
        boardIndex += 1
        slotIndex = 0
      }
    }

    const nextPlacement = { boardIndex, slotIndex }
    placements[post.postNo] = nextPlacement
    usedSlots.add(getSlotKey(boardIndex, slotIndex))
  })

  return placements
}

function formatCreatedAt(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

function clampPage(nextPage, totalPages) {
  return Math.max(0, Math.min(totalPages - 1, nextPage))
}

function HomePage() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser.userId === ADMIN_USER_ID
  const boardGestureRef = useRef({
    isDragging: false,
    startX: 0,
    lastMoveAt: 0,
  })
  const tableGestureRef = useRef({
    isDragging: false,
    startX: 0,
    lastMoveAt: 0,
  })
  const boardWheelRef = useRef(0)
  const tableWheelRef = useRef(0)
  const [activeTab, setActiveTab] = useState('board')
  const [posts, setPosts] = useState([])
  const [placements, setPlacements] = useState({})
  const [currentBoardIndex, setCurrentBoardIndex] = useState(0)
  const [boardTransitionDirection, setBoardTransitionDirection] = useState('left')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [users, setUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [userDeleteTarget, setUserDeleteTarget] = useState(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [tableTransitionDirection, setTableTransitionDirection] = useState('left')
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [tablePage, setTablePage] = useState(0)
  const [form, setForm] = useState({
    title: '',
    content: '',
  })
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [selectedPostError, setSelectedPostError] = useState('')
  const [isLoadingSelectedPost, setIsLoadingSelectedPost] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadPosts = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const response = await getPosts()
        if (!isMounted) {
          return
        }

        const nextPlacements = normalizePlacements(response, readStoredPlacements())
        setPosts(response)
        setPlacements(nextPlacements)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(getErrorMessage(error, '게시글 목록을 불러오지 못했습니다.'))
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadPosts()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (posts.length === 0) {
      writeStoredPlacements({})
      return
    }

    const postIds = new Set(posts.map((post) => String(post.postNo)))
    const persistedPlacements = Object.fromEntries(
      Object.entries(placements).filter(([postNo]) => postIds.has(String(postNo))),
    )
    writeStoredPlacements(persistedPlacements)
  }, [placements, posts])

  useEffect(() => {
    if (!isAdmin) {
      return
    }

    let isMounted = true

    const loadUsers = async () => {
      setIsLoadingUsers(true)
      setUsersError('')

      try {
        const response = await getUsers()
        if (!isMounted) {
          return
        }

        setUsers(response)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setUsersError(getErrorMessage(error, '회원 목록을 불러오지 못했습니다.'))
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false)
        }
      }
    }

    loadUsers()

    return () => {
      isMounted = false
    }
  }, [isAdmin])

  const boardCount = useMemo(() => {
    const indices = Object.values(placements).map((placement) => placement.boardIndex)
    return Math.max(1, ...indices.map((index) => index + 1), posts.length > 0 ? 1 : 0)
  }, [placements, posts.length])

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime()
        const rightTime = new Date(right.createdAt).getTime()

        if (rightTime !== leftTime) {
          return rightTime - leftTime
        }

        return right.postNo - left.postNo
      }),
    [posts],
  )

  useEffect(() => {
    if (currentBoardIndex > boardCount - 1) {
      setCurrentBoardIndex(Math.max(0, boardCount - 1))
    }
  }, [boardCount, currentBoardIndex])

  useEffect(() => {
    const totalTablePages = Math.max(1, Math.ceil(sortedPosts.length / 10))
    if (tablePage > totalTablePages - 1) {
      setTablePage(Math.max(0, totalTablePages - 1))
    }
  }, [sortedPosts, tablePage])

  const postsInCurrentBoard = sortedPosts.filter(
    (post) => (placements[post.postNo]?.boardIndex ?? 0) === currentBoardIndex,
  )
  const totalTablePages = Math.max(1, Math.ceil(sortedPosts.length / 10))
  const pagedPosts = sortedPosts.slice(tablePage * 10, tablePage * 10 + 10)

  const moveBoardPage = (direction) => {
    setCurrentBoardIndex((current) => {
      const nextPage = clampPage(current + direction, boardCount)
      if (nextPage !== current) {
        setBoardTransitionDirection(direction > 0 ? 'left' : 'right')
      }
      return nextPage
    })
  }

  const moveTablePage = (direction) => {
    setTablePage((current) => {
      const nextPage = clampPage(current + direction, totalTablePages)
      if (nextPage !== current) {
        setTableTransitionDirection(direction > 0 ? 'left' : 'right')
      }
      return nextPage
    })
  }

  const handlePagedWheel = (event, totalPages, movePage, wheelRef) => {
    if (totalPages <= 1) {
      return
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0
    if (Math.abs(delta) < 18) {
      return
    }

    const now = Date.now()
    if (now - wheelRef.current < 280) {
      return
    }

    wheelRef.current = now
    movePage(delta > 0 ? 1 : -1)
  }

  const handleGestureStart = (event, gestureRef) => {
    if (event.button !== 0) {
      return
    }

    const interactiveTarget = event.target.closest(
      'button, input, textarea, select, a, table, tbody, thead, tr, td, th',
    )
    if (interactiveTarget) {
      return
    }

    gestureRef.current.isDragging = true
    gestureRef.current.startX = event.clientX
    gestureRef.current.lastMoveAt = 0
  }

  const handleGestureMove = (event, totalPages, movePage, gestureRef) => {
    if (!gestureRef.current.isDragging || totalPages <= 1) {
      return
    }

    const distanceX = event.clientX - gestureRef.current.startX
    if (Math.abs(distanceX) < 60) {
      return
    }

    const now = Date.now()
    if (now - gestureRef.current.lastMoveAt < 180) {
      return
    }

    gestureRef.current.lastMoveAt = now
    gestureRef.current.startX = event.clientX
    movePage(distanceX < 0 ? 1 : -1)
  }

  const handleGestureEnd = (gestureRef) => {
    gestureRef.current.isDragging = false
  }

  const canDeleteSelectedPost =
    selectedPost !== null &&
    (selectedPost.userId === currentUser.userId || currentUser.userId === ADMIN_USER_ID)

  const canDeleteByOwnership = selectedPost !== null && selectedPost.userId === currentUser.userId

  const handleComposerChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleOpenComposer = () => {
    setSaveError('')
    setIsComposerOpen(true)
  }

  const resetComposer = () => {
    setSaveError('')
    setForm({
      title: '',
      content: '',
    })
  }

  const handleCloseComposer = (forceClose = false) => {
    if (isSaving && !forceClose) {
      return
    }

    setIsComposerOpen(false)
    resetComposer()
  }

  const handleSubmitPost = async (event) => {
    event.preventDefault()
    setSaveError('')
    setIsSaving(true)

    try {
      const createdPost = await createPost({
        userId: currentUser.userId,
        title: form.title,
        content: form.content,
      })

      setPosts((current) => {
        const nextPosts = [createdPost, ...current]
        setPlacements((currentPlacements) => {
          const existingPostsByPlacement = [...current].sort((left, right) => {
            const leftPlacement = currentPlacements[left.postNo] ?? { boardIndex: 0, slotIndex: 0 }
            const rightPlacement = currentPlacements[right.postNo] ?? { boardIndex: 0, slotIndex: 0 }
            return getPlacementOrder(leftPlacement) - getPlacementOrder(rightPlacement)
          })
          const nextPlacements = buildSequentialPlacements([createdPost, ...existingPostsByPlacement])
          setCurrentBoardIndex(0)
          return nextPlacements
        })
        return nextPosts
      })
      handleCloseComposer(true)
    } catch (error) {
      setSaveError(getErrorMessage(error, '게시글 등록에 실패했습니다.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenPost = async (postNo) => {
    setSelectedPostError('')
    setIsLoadingSelectedPost(true)
    setSelectedPost(null)
    setIsDeletingPost(false)
    setIsDeleteConfirmOpen(false)

    try {
      const response = await getPost(postNo)
      setSelectedPost(response)
    } catch (error) {
      setSelectedPostError(getErrorMessage(error, '게시글 내용을 불러오지 못했습니다.'))
    } finally {
      setIsLoadingSelectedPost(false)
    }
  }

  const handleOpenDeleteConfirm = () => {
    if (!canDeleteSelectedPost || isLoadingSelectedPost || isDeletingPost) {
      return
    }

    setIsDeleteConfirmOpen(true)
  }

  const handleCloseDeleteConfirm = () => {
    if (isDeletingPost) {
      return
    }

    setIsDeleteConfirmOpen(false)
  }

  const handleOpenUserDeleteConfirm = (user) => {
    if (user.userId === ADMIN_USER_ID || isDeletingUser) {
      return
    }

    setUsersError('')
    setUserDeleteTarget(user)
  }

  const handleCloseUserDeleteConfirm = () => {
    if (isDeletingUser) {
      return
    }

    setUserDeleteTarget(null)
  }

  const handleDeleteUser = async () => {
    if (!userDeleteTarget) {
      return
    }

    setUsersError('')
    setIsDeletingUser(true)

    try {
      await deleteUser(userDeleteTarget.userId, currentUser.userId)
      setUsers((current) => current.filter((user) => user.userId !== userDeleteTarget.userId))
      setUserDeleteTarget(null)
    } catch (error) {
      setUsersError(getErrorMessage(error, '회원 삭제에 실패했습니다.'))
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleDeletePost = async () => {
    if (!selectedPost || !canDeleteSelectedPost) {
      return
    }

    setSelectedPostError('')
    setIsDeletingPost(true)

    try {
      await deletePost(selectedPost.postNo, currentUser.userId)
      setPosts((current) => {
        const remainingPosts = current.filter((post) => post.postNo !== selectedPost.postNo)

        setPlacements((currentPlacements) => {
          const orderedRemainingPosts = [...remainingPosts].sort((left, right) => {
            const leftPlacement = currentPlacements[left.postNo] ?? { boardIndex: 0, slotIndex: 0 }
            const rightPlacement =
              currentPlacements[right.postNo] ?? { boardIndex: 0, slotIndex: 0 }
            return getPlacementOrder(leftPlacement) - getPlacementOrder(rightPlacement)
          })

          return buildSequentialPlacements(orderedRemainingPosts)
        })

        return remainingPosts
      })
      setIsDeleteConfirmOpen(false)
      handleClosePost(true)
    } catch (error) {
      setSelectedPostError(
        getErrorMessage(error, '게시글 삭제에 실패했습니다. 백엔드 재시작 후 다시 시도해 주세요.'),
      )
      setIsDeleteConfirmOpen(false)
    } finally {
      setIsDeletingPost(false)
    }
  }

  const handleClosePost = (forceClose = false) => {
    if (isDeletingPost && !forceClose) {
      return
    }

    setSelectedPost(null)
    setSelectedPostError('')
    setIsLoadingSelectedPost(false)
    setIsDeleteConfirmOpen(false)
  }

  return (
    <>
      <section className="home-page">
        <div className="home-toolbar">
          <div className="home-intro">
            <h1>Home</h1>
            <p>
              {currentUser.name} ({currentUser.userId}) 님이 로그인 중입니다.
            </p>
          </div>

          {activeTab === 'board' ? (
            <button className="primary-button" onClick={handleOpenComposer} type="button">
              글쓰기
            </button>
          ) : null}
        </div>

        <div className="home-tabs">
          <button
            className={activeTab === 'board' ? 'tab-button tab-button-active' : 'tab-button'}
            onClick={() => setActiveTab('board')}
            type="button"
          >
            보드
          </button>
          <button
            className={activeTab === 'table' ? 'tab-button tab-button-active' : 'tab-button'}
            onClick={() => setActiveTab('table')}
            type="button"
          >
            테이블
          </button>
          {isAdmin ? (
            <button
              className={activeTab === 'users' ? 'tab-button tab-button-active' : 'tab-button'}
              onClick={() => setActiveTab('users')}
              type="button"
            >
              회원 목록
            </button>
          ) : null}
        </div>

        {activeTab === 'board' ? (
          <>
            {loadError ? <div className="feedback feedback-error">{loadError}</div> : null}

            <div
              className="home-board draggable-surface"
              onMouseDown={(event) => handleGestureStart(event, boardGestureRef)}
              onMouseLeave={() => handleGestureEnd(boardGestureRef)}
              onMouseMove={(event) =>
                handleGestureMove(event, boardCount, moveBoardPage, boardGestureRef)
              }
              onMouseUp={() => handleGestureEnd(boardGestureRef)}
              onWheel={(event) => handlePagedWheel(event, boardCount, moveBoardPage, boardWheelRef)}
            >
              {isLoading ? (
                <div className="board-placeholder">
                  <strong>게시글을 불러오는 중입니다.</strong>
                  <span>잠시만 기다려 주세요.</span>
                </div>
              ) : null}

              {!isLoading && posts.length === 0 ? (
                <div className="board-placeholder">
                  <strong>아직 등록된 메모가 없습니다.</strong>
                  <span>우측 상단의 글쓰기 버튼으로 첫 게시글을 작성해 보세요.</span>
                </div>
              ) : null}

              {!isLoading && posts.length > 0 ? (
                <>
                  <div
                    className={`paged-content page-slide-${boardTransitionDirection}`}
                    key={`board-page-${currentBoardIndex}`}
                  >
                    <div className="board-page-indicator">
                      {currentBoardIndex + 1} / {boardCount} 보드
                    </div>

                    <div className="sticky-board">
                      {postsInCurrentBoard.map((post, index) => {
                        const placement = placements[post.postNo] ?? { boardIndex: 0, slotIndex: 0 }
                        const slot = BOARD_SLOTS[placement.slotIndex]
                        const authorColor = getAuthorColor(post.userId)

                        return (
                          <button
                            key={post.postNo}
                            className="sticky-note"
                            onClick={() => handleOpenPost(post.postNo)}
                            style={{
                              left: slot.left,
                              top: slot.top,
                              zIndex: postsInCurrentBoard.length - index,
                              backgroundColor: authorColor.background,
                              ['--note-transform']: NOTE_ROTATIONS[index % NOTE_ROTATIONS.length],
                              ['--pin-color']: authorColor.pin,
                              ['--hover-outline']: authorColor.outline,
                            }}
                          type="button"
                        >
                          <span className="sticky-note-pin" />
                          <strong title={post.title}>{truncateText(post.title, 30)}</strong>
                          <div className="sticky-note-meta">
                            <span>{post.userId}</span>
                            <span>{formatCreatedAt(post.createdAt)}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="board-navigation">
                    <button
                      className="nav-arrow-button"
                      disabled={currentBoardIndex === 0}
                      onClick={() => moveBoardPage(-1)}
                      type="button"
                    >
                      {'<'}
                    </button>
                    <button
                      className="nav-arrow-button"
                      disabled={currentBoardIndex >= boardCount - 1}
                      onClick={() => moveBoardPage(1)}
                      type="button"
                    >
                      {'>'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {activeTab === 'table' ? (
          <section
            className="posts-table-panel draggable-surface"
            onMouseDown={(event) => handleGestureStart(event, tableGestureRef)}
            onMouseLeave={() => handleGestureEnd(tableGestureRef)}
            onMouseMove={(event) =>
              handleGestureMove(event, totalTablePages, moveTablePage, tableGestureRef)
            }
            onMouseUp={() => handleGestureEnd(tableGestureRef)}
            onWheel={(event) =>
              handlePagedWheel(event, totalTablePages, moveTablePage, tableWheelRef)
            }
          >
            {loadError ? <div className="feedback feedback-error">{loadError}</div> : null}

            {isLoading ? (
              <div className="board-placeholder">
                <strong>게시글 테이블을 불러오는 중입니다.</strong>
                <span>잠시만 기다려 주세요.</span>
              </div>
            ) : null}

            {!isLoading ? (
              <>
                <div className="table-toolbar">
                  <span className="table-page-indicator">
                    {tablePage + 1} / {totalTablePages} 페이지
                  </span>
                  <div className="table-navigation">
                    <button
                      className="nav-arrow-button"
                      disabled={tablePage === 0}
                      onClick={() => moveTablePage(-1)}
                      type="button"
                    >
                      {'<'}
                    </button>
                    <button
                      className="nav-arrow-button"
                      disabled={tablePage >= totalTablePages - 1}
                      onClick={() => moveTablePage(1)}
                      type="button"
                    >
                      {'>'}
                    </button>
                  </div>
                </div>

                <div
                  className={`paged-content page-slide-${tableTransitionDirection}`}
                  key={`table-page-${tablePage}`}
                >
                  <div className="posts-table-wrapper">
                    <table className="posts-table">
                      <colgroup>
                        <col className="posts-col-number" />
                        <col className="posts-col-title" />
                        <col className="posts-col-content" />
                        <col className="posts-col-author" />
                        <col className="posts-col-date" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>번호</th>
                          <th>제목</th>
                          <th>내용</th>
                          <th>작성자</th>
                          <th>작성일시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedPosts.map((post, index) => (
                          <tr key={post.postNo} onClick={() => handleOpenPost(post.postNo)}>
                            <td>{tablePage * 10 + index + 1}</td>
                            <td title={post.title}>{truncateText(post.title, 24)}</td>
                            <td title={post.content}>{truncateText(post.content, 52)}</td>
                            <td>{post.userId}</td>
                            <td>{formatCreatedAt(post.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}

            {!isLoading && pagedPosts.length === 0 ? (
              <div className="board-placeholder">
                <strong>표시할 게시글이 없습니다.</strong>
              </div>
            ) : null}
          </section>
        ) : null}

        {isAdmin && activeTab === 'users' ? (
          <section className="users-panel">
            {usersError ? <div className="feedback feedback-error">{usersError}</div> : null}

            {isLoadingUsers ? (
              <div className="board-placeholder">
                <strong>회원 목록을 불러오는 중입니다.</strong>
                <span>잠시만 기다려 주세요.</span>
              </div>
            ) : null}

            {!isLoadingUsers ? (
              <div className="user-list">
                {users.map((user) => (
                  <article className="user-card" key={user.userId}>
                    <div className="user-card-header">
                      <strong>{user.userId}</strong>
                      <button
                        className={user.userId === ADMIN_USER_ID ? 'muted-button' : 'danger-button'}
                        disabled={user.userId === ADMIN_USER_ID || isDeletingUser}
                        onClick={() => handleOpenUserDeleteConfirm(user)}
                        type="button"
                      >
                        삭제
                      </button>
                    </div>
                    <span>{user.name}</span>
                    <span>{formatCreatedAt(user.createdAt)}</span>
                    <span>{user.ipAddress}</span>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>

      {isComposerOpen ? (
        <div className="modal-backdrop" onClick={handleCloseComposer} role="presentation">
          <section
            aria-labelledby="composer-title"
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="composer-title">글쓰기</h2>
                <p>{currentUser.userId} 계정으로 작성됩니다.</p>
              </div>
              <button className="text-button" onClick={handleCloseComposer} type="button">
                닫기
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmitPost}>
              {saveError ? <div className="feedback feedback-error">{saveError}</div> : null}

              <div className="field-group">
                <label htmlFor="writer">작성자</label>
                <input disabled id="writer" value={currentUser.userId} />
              </div>

              <div className="field-group">
                <label htmlFor="title">제목</label>
                <input
                  id="title"
                  maxLength={150}
                  name="title"
                  onChange={handleComposerChange}
                  required
                  value={form.title}
                />
                <div className="field-meta">
                  <span>최대 150자</span>
                  <span>{form.title.length} / 150</span>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="content">내용</label>
                <textarea
                  id="content"
                  maxLength={4000}
                  name="content"
                  onChange={handleComposerChange}
                  required
                  rows="7"
                  value={form.content}
                />
                <div className="field-meta">
                  <span>최대 4000자</span>
                  <span>{form.content.length} / 4000</span>
                </div>
              </div>

              <div className="modal-actions">
                <button className="secondary-button" onClick={handleCloseComposer} type="button">
                  취소
                </button>
                <button className="primary-button" disabled={isSaving} type="submit">
                  {isSaving ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isLoadingSelectedPost || selectedPost || selectedPostError ? (
        <div className="modal-backdrop" onClick={handleClosePost} role="presentation">
          <section
            aria-labelledby="post-detail-title"
            className="modal-card modal-card-detail"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="post-detail-title">메모 보기</h2>
                <p>스티커 메모를 클릭해 확인한 내용입니다.</p>
              </div>
              <div className="modal-header-actions">
                <button
                  className={canDeleteSelectedPost ? 'danger-button' : 'muted-button'}
                  disabled={!canDeleteSelectedPost || isDeletingPost || isLoadingSelectedPost}
                  onClick={handleOpenDeleteConfirm}
                  type="button"
                >
                  삭제
                </button>
                <button className="text-button" onClick={handleClosePost} type="button">
                  닫기
                </button>
              </div>
            </div>

            {isLoadingSelectedPost ? (
              <div className="board-placeholder">
                <strong>내용을 불러오는 중입니다.</strong>
                <span>잠시만 기다려 주세요.</span>
              </div>
            ) : null}

            {selectedPostError ? (
              <div className="feedback feedback-error">{selectedPostError}</div>
            ) : null}

            {selectedPost ? (
              <article className="post-detail">
                <div className="post-detail-meta">
                  <span>작성자 {selectedPost.userId}</span>
                  <span>{formatCreatedAt(selectedPost.createdAt)}</span>
                </div>
                <h3>{selectedPost.title}</h3>
                <p>{selectedPost.content}</p>
                {!canDeleteByOwnership && currentUser.userId !== ADMIN_USER_ID ? (
                  <span className="delete-hint">본인이 작성한 게시글만 삭제할 수 있습니다.</span>
                ) : null}
              </article>
            ) : null}
          </section>
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <div className="modal-backdrop" onClick={handleCloseDeleteConfirm} role="presentation">
          <section
            aria-labelledby="delete-confirm-title"
            className="confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-confirm-title">삭제하시겠습니까?</h2>
            <p>Yes를 누르면 해당 메모가 DB와 화면에서 모두 삭제됩니다.</p>
            <div className="confirm-actions">
              <button className="secondary-button" onClick={handleCloseDeleteConfirm} type="button">
                No
              </button>
              <button
                className="danger-button"
                disabled={isDeletingPost}
                onClick={handleDeletePost}
                type="button"
              >
                {isDeletingPost ? '삭제 중...' : 'Yes'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {userDeleteTarget ? (
        <div className="modal-backdrop" onClick={handleCloseUserDeleteConfirm} role="presentation">
          <section
            aria-labelledby="user-delete-confirm-title"
            className="confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="user-delete-confirm-title">정말 삭제하시겠습니까?</h2>
            <p>{userDeleteTarget.userId} 계정을 삭제하면 DB에서도 함께 삭제됩니다.</p>
            <div className="confirm-actions">
              <button className="secondary-button" onClick={handleCloseUserDeleteConfirm} type="button">
                No
              </button>
              <button
                className="danger-button"
                disabled={isDeletingUser}
                onClick={handleDeleteUser}
                type="button"
              >
                {isDeletingUser ? '삭제 중...' : 'Yes'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default HomePage
