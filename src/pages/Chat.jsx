import { useEffect, useState, useRef, useCallback } from "react"
import { io } from 'socket.io-client'
import { toast, ToastContainer } from "react-toastify"
import storeAuth from "../context/storeAuth"
import storeProfile from "../context/storeProfile"

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || BASE_URL.replace(/\/api\/?$/, '')

const Chat = () => {
    const { token, userId, rol } = storeAuth()
    const { user } = storeProfile()
    const isAdminOrDocente = rol === 'admin' || rol === 'docente'

    const [socket, setSocket] = useState(null)
    const [isOpen, setIsOpen] = useState(false)
    const [chatMode, setChatMode] = useState('private')
    const [view, setView] = useState('conversations')

    const [conversations, setConversations] = useState([])
    const [activeConversation, setActiveConversation] = useState(null)
    const [messages, setMessages] = useState([])
    const [messageText, setMessageText] = useState("")
    const [loadingMsgs, setLoadingMsgs] = useState(false)

    const [usuarios, setUsuarios] = useState([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loadingUsers, setLoadingUsers] = useState(false)

    const [generalMessages, setGeneralMessages] = useState([])
    const [generalText, setGeneralText] = useState("")
    const [onlineUsers, setOnlineUsers] = useState([])
    const [generalLoading, setGeneralLoading] = useState(false)
    const [connected, setConnected] = useState(false)

    const messagesEndRef = useRef(null)
    const activeConversationRef = useRef(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        if (isOpen) scrollToBottom()
    }, [messages, generalMessages, isOpen])

    const fetchConversations = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch(`${BASE_URL}/chat/conversations`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) return
            const data = await res.json()
            setConversations(Array.isArray(data?.data) ? data.data : [])
        } catch {
            setConversations([])
        }
    }, [token])

    const socketRef = useRef(null)
    const userRef = useRef(user)
    const userIdRef = useRef(userId)
    const fetchConversationsRef = useRef(fetchConversations)

    useEffect(() => {
        userRef.current = user
        userIdRef.current = userId
        fetchConversationsRef.current = fetchConversations
        activeConversationRef.current = activeConversation
    }, [user, userId, fetchConversations, activeConversation])

    useEffect(() => {
        if (!token) return

        const s = io(SOCKET_URL, {
            auth: { token },
            reconnectionAttempts: 3,
            timeout: 5000
        })
        socketRef.current = s
        setSocket(s)

        s.on('connect', () => setConnected(true))
        s.on('disconnect', () => setConnected(false))
        s.on('connect_error', (err) => console.warn('Socket:', err.message))

        s.on('mensaje-privado-recibido', (payload) => {
            const activa = activeConversationRef.current
            if (activa && payload.conversationId === activa._id) {
                setMessages(prev => [
                    ...prev,
                    { ...payload, isOwn: payload.senderId === userIdRef.current }
                ])
            }
            fetchConversationsRef.current()
        })

        s.on('mensaje-recibido', (msg) => setGeneralMessages(prev => [...prev, msg]))
        s.on('usuarios-online', (lista) => setOnlineUsers(Array.isArray(lista) ? lista : []))

        return () => {
            s.removeAllListeners()
            s.disconnect()
            socketRef.current = null
            setSocket(null)
            setConnected(false)
        }
    }, [token])

    useEffect(() => {
        if (!connected || !user || !socketRef.current) return
        socketRef.current.emit('usuario-conectado', {
            _id: userId,
            nombre: user.nombre || 'Usuario',
            email: user.email || '',
            rol: rol || 'invitado'
        })
    }, [connected, user, userId, rol])

    const fetchMessages = async (conversationId) => {
        setLoadingMsgs(true)
        try {
            const res = await fetch(`${BASE_URL}/chat/conversation/${conversationId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) {
                setMessages([])
                return
            }
            const data = await res.json()
            const msgs = Array.isArray(data?.data) ? data.data : []
            setMessages(msgs.map(m => ({ ...m, isOwn: m.senderId === userId })))
        } catch {
            setMessages([])
        } finally {
            setLoadingMsgs(false)
        }
    }

    const fetchGeneralMessages = async () => {
        setGeneralLoading(true)
        try {
            const res = await fetch(`${BASE_URL}/chat/messages?room=general`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) {
                setGeneralMessages([])
                return
            }
            const data = await res.json()
            setGeneralMessages(Array.isArray(data?.data) ? data.data : [])
        } catch {
            setGeneralMessages([])
        } finally {
            setGeneralLoading(false)
        }
    }

    const sendGeneralMessage = () => {
        if (!generalText.trim() || !socket) return
        const senderName = user?.nombre || 'Usuario'
        socket.emit('enviar-mensaje', {
            text: generalText.trim(),
            from: senderName,
            room: 'general'
        })
        setGeneralText("")
    }

    const fetchUsuarios = async () => {
        setLoadingUsers(true)
        try {
            const [resEst, resDoc] = await Promise.all([
                fetch(`${BASE_URL}/estudiantes`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${BASE_URL}/docentes`, { headers: { Authorization: `Bearer ${token}` } })
            ])
            if (!resEst.ok || !resDoc.ok) {
                setUsuarios([])
                return
            }
            const dataEst = await resEst.json()
            const dataDoc = await resDoc.json()
            const estudiantes = (Array.isArray(dataEst?.data) ? dataEst.data : []).map(e => ({ ...e, tipo: 'Estudiante' }))
            const docentes = (Array.isArray(dataDoc?.data) ? dataDoc.data : []).map(d => ({ ...d, tipo: 'Docente' }))
            setUsuarios([...estudiantes, ...docentes].filter(u => u._id !== userId))
        } catch {
            setUsuarios([])
        } finally {
            setLoadingUsers(false)
        }
    }

    const openConversation = async (conv) => {
        setActiveConversation(conv)
        setView('messages')
        await fetchMessages(conv._id)
    }

    const startNewChat = async (otherUser) => {
        try {
            const res = await fetch(`${BASE_URL}/chat/conversation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ participantIds: [userId, otherUser._id] })
            })
            if (!res.ok) {
                toast.error("No se pudo iniciar la conversación")
                return
            }
            const data = await res.json()
            if (data?.data) {
                setActiveConversation(data.data)
                setView('messages')
                await fetchMessages(data.data._id)
                fetchConversations()
            }
        } catch {
            toast.error("No se pudo iniciar la conversación")
        }
    }

    const sendMessage = async () => {
        if (!messageText.trim() || !activeConversation) return
        const senderName = user?.nombre || 'Usuario'

        const tempMsg = {
            _id: Date.now(),
            conversationId: activeConversation._id,
            senderId: userId,
            senderName,
            text: messageText.trim(),
            timestamp: new Date().toISOString(),
            isOwn: true
        }

        setMessages(prev => [...prev, tempMsg])
        setMessageText("")

        try {
            const res = await fetch(`${BASE_URL}/chat/private-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    conversationId: activeConversation._id,
                    senderId: userId,
                    senderName,
                    text: tempMsg.text
                })
            })
            if (!res.ok) {
                toast.error("Error al enviar mensaje")
                setMessages(prev => prev.filter(m => m._id !== tempMsg._id))
                return
            }
            fetchConversations()
        } catch {
            toast.error("Error al enviar mensaje")
            setMessages(prev => prev.filter(m => m._id !== tempMsg._id))
        }
    }

    const getOtherParticipantName = (conv) => {
        if (!conv?.participantIds || !conv?.participantNames) return 'Usuario'
        const otherId = conv.participantIds.find(id => id !== userId)
        return conv.participantNames[otherId] || 'Usuario'
    }

    const formatTime = (ts) => {
        if (!ts) return ''
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (ts) => {
        if (!ts) return ''
        const d = new Date(ts)
        const today = new Date()
        if (d.toDateString() === today.toDateString()) return formatTime(ts)
        return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
    }

    const filteredUsers = usuarios.filter(u => {
        const fullName = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase()
        return fullName.includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const handleOpen = () => {
        setIsOpen(true)
        setChatMode('private')
        setView('conversations')
        fetchConversations()
    }

    const goBack = () => {
        if (view === 'messages') {
            setView('conversations')
            setActiveConversation(null)
            setMessages([])
        } else {
            setView('conversations')
        }
    }

    if (!token) return null

    return (
        <>
            <ToastContainer position="top-right" autoClose={2000} />

            {isOpen && (
                <div className="fixed bottom-24 right-4 z-40 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 w-[calc(100vw-2rem)] max-w-[400px] h-[70vh] max-h-[580px]">

                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex justify-between items-center shadow-md shrink-0">
                        <div className="flex items-center gap-2">
                            {chatMode === 'private' && (view === 'messages' || view === 'newChat') && (
                                <button onClick={goBack} className="text-white hover:bg-white hover:bg-opacity-20 p-1.5 rounded-full transition-all">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <div>
                                <h2 className="font-bold text-white text-base leading-tight">
                                    {chatMode === 'general' && 'Chat General'}
                                    {chatMode === 'private' && view === 'conversations' && 'Mensajes'}
                                    {chatMode === 'private' && view === 'newChat' && 'Nueva conversación'}
                                    {chatMode === 'private' && view === 'messages' && (activeConversation ? getOtherParticipantName(activeConversation) : 'Chat')}
                                </h2>
                                {chatMode === 'general' && (
                                    <p className="text-xs text-indigo-200">{connected ? 'Conectado' : 'Desconectado'} · {onlineUsers.length} online</p>
                                )}
                                {chatMode === 'private' && view === 'conversations' && (
                                    <p className="text-xs text-indigo-200">{user?.nombre || ''}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {isAdminOrDocente && chatMode === 'private' && view === 'conversations' && (
                                <button onClick={() => { setChatMode('general'); fetchGeneralMessages() }}
                                    className="text-xs text-white bg-blue-800 bg-opacity-20 hover:bg-opacity-30 px-3 py-1.5 rounded-full transition-all font-medium">
                                    General
                                </button>
                            )}
                            {isAdminOrDocente && chatMode === 'general' && (
                                <button onClick={() => { setChatMode('private'); setView('conversations') }}
                                    className="text-xs text-white bg-blue-800 bg-opacity-20 hover:bg-opacity-30 px-3 py-1.5 rounded-full transition-all font-medium">
                                    Privado
                                </button>
                            )}
                            {chatMode === 'private' && view === 'conversations' && (
                                <button onClick={() => { setView('newChat'); fetchUsuarios() }}
                                    className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-all">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {chatMode === 'private' && view === 'conversations' && (
                        <div className="flex-1 overflow-y-auto bg-gray-50">
                            {conversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 p-8">
                                    <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <p className="text-sm font-semibold text-center text-gray-500">No tienes conversaciones aún</p>
                                    <button onClick={() => { setView('newChat'); fetchUsuarios() }}
                                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all active:scale-95">
                                        Iniciar conversación
                                    </button>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {conversations.map(conv => (
                                        <button key={conv._id} onClick={() => openConversation(conv)}
                                            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-indigo-50 active:bg-indigo-100 transition-all text-left">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                                {getOtherParticipantName(conv).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="font-semibold text-gray-800 text-sm truncate">{getOtherParticipantName(conv)}</span>
                                                    <span className="text-[11px] text-gray-400 shrink-0 ml-2">{formatDate(conv.lastMessageAt)}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">{conv.lastMessage || 'Sin mensajes aún'}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {chatMode === 'private' && view === 'newChat' && (
                        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                            <div className="p-3 border-b border-gray-100 bg-white shrink-0">
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o email..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                                {loadingUsers ? (
                                    <div className="flex justify-center items-center h-32">
                                        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm p-8">No se encontraron usuarios</p>
                                ) : (
                                    filteredUsers.map(u => (
                                        <button key={u._id} onClick={() => startNewChat(u)}
                                            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-indigo-50 active:bg-indigo-100 transition-all text-left">
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                                                {(u.nombre || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-800 text-sm truncate">{u.nombre} {u.apellido}</p>
                                                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                            </div>
                                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${u.tipo === 'Docente' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {u.tipo}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {chatMode === 'general' && (
                        <>
                            <div className="flex gap-1.5 p-2 overflow-x-auto border-b border-gray-100 bg-white shrink-0">
                                {onlineUsers.filter(u => u.rol === 'admin' || u.rol === 'docente').map((u, i) => (
                                    <span key={i} className="bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap">
                                        {u.nombre}
                                    </span>
                                ))}
                                {onlineUsers.length === 0 && (
                                    <span className="text-xs text-gray-400 px-2">Sin usuarios conectados</span>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                                {generalLoading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : generalMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                        <p className="text-sm font-semibold">No hay mensajes aún</p>
                                    </div>
                                ) : (
                                    generalMessages.map((msg, i) => (
                                        <div key={msg._id || i} className="flex flex-col">
                                            <div className="bg-white rounded-2xl rounded-tl-none shadow-sm border border-gray-100 px-4 py-2.5">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-xs font-bold text-indigo-600">{msg.from}</span>
                                                    <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                                                </div>
                                                <p className="text-sm text-gray-800 break-words leading-relaxed">{msg.text}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="bg-white border-t border-gray-100 p-3 shrink-0 pb-safe">
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Escribe un mensaje..."
                                        value={generalText}
                                        onChange={e => setGeneralText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                sendGeneralMessage()
                                            }
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 text-sm"
                                    />
                                    <button onClick={sendGeneralMessage}
                                        className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 transform rotate-45 -translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {chatMode === 'private' && view === 'messages' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                                {loadingMsgs ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                        <svg className="w-14 h-14 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <p className="text-sm font-semibold">¡Sé el primero en escribir!</p>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => (
                                        <div key={msg._id || i} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                                            <div className="max-w-[78%]">
                                                {!msg.isOwn && (
                                                    <span className="text-[11px] font-bold text-gray-500 ml-1 block mb-0.5">{msg.senderName}</span>
                                                )}
                                                <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm ${msg.isOwn ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                                    <p className="break-words leading-relaxed">{msg.text}</p>
                                                    <span className={`text-[10px] block text-right mt-1 ${msg.isOwn ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                        {formatTime(msg.timestamp)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="bg-white border-t border-gray-100 p-3 shrink-0 pb-safe">
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Escribe un mensaje..."
                                        value={messageText}
                                        onChange={e => setMessageText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                sendMessage()
                                            }
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 text-sm"
                                    />
                                    <button onClick={sendMessage}
                                        className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 transform rotate-45 -translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="fixed bottom-6 right-6 z-50">
                <button onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transform hover:scale-110 active:scale-95 transition-all duration-200 relative">
                    {conversations.length > 0 && !isOpen && (
                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow">
                            {conversations.length}
                        </span>
                    )}
                    {isOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    )}
                </button>
            </div>
        </>
    )
}

export default Chat