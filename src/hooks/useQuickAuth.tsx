import { sdk } from '@farcaster/miniapp-sdk'
import { useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useReconnect } from 'wagmi'
import { toast } from 'sonner'
import type { Address } from 'viem'

interface UserData {
  fid: number
  displayName: string
  username: string
  pfpUrl?: string
  primaryAddress?: string
}

interface QuickAuthResult {
  isAuthenticated: boolean
  farcasterAddress: Address | null
  userData: UserData | null
}

export function useQuickAuth(isInFarcaster: boolean): QuickAuthResult {
  const hasAuthenticated = useRef(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [farcasterAddress, setFarcasterAddress] = useState<Address | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  
  const { isConnected, address } = useAccount()
  const { connectors, connect } = useConnect()
  const { reconnect } = useReconnect()

  useEffect(() => {
    const authenticateUser = async (): Promise<void> => {
      try {
        if (!isInFarcaster) return
        
        if (hasAuthenticated.current) return
        hasAuthenticated.current = true
        
        console.log('🎯 Farcaster detected - Starting Quick Auth...')
        
        const response: Response = await sdk.quickAuth.fetch('/api/me')
        
        if (response.ok) {
          const data: UserData = await response.json()
          setUserData(data)
          setIsAuthenticated(true)
          
          console.log('✅ Quick Auth successful:', data)
          
          // Auto-connect wallet if Farcaster address is available
          if (data.primaryAddress) {
            const farcasterAddr = data.primaryAddress as Address
            setFarcasterAddress(farcasterAddr)
            
            // If not already connected or connected to different address
            if (!isConnected || address?.toLowerCase() !== farcasterAddr.toLowerCase()) {
              console.log('🔗 Auto-connecting Farcaster wallet...', farcasterAddr)
              
              // Wait a bit for connectors to be ready
              await new Promise(resolve => setTimeout(resolve, 500))
              
              // Strategy 1: Try reconnect first (silent)
              try {
                await reconnect()
                console.log('✅ Wallet reconnected successfully')
                // SESSİZ MOD: Bildirim kaldırıldı
                return
              } catch (err) {
                console.log('⚠️ Reconnect failed, trying direct connect...')
              }
              
              // Strategy 2: Try connectors in priority order
              const priorityConnectors = [
                connectors.find(c => c.id === 'coinbaseWalletSDK' || c.name === 'Coinbase Wallet'),
                connectors.find(c => c.id === 'walletConnect'),
                connectors.find(c => c.id === 'injected' || c.type === 'injected'),
                ...connectors
              ].filter((c, idx, arr) => c && arr.findIndex(x => x?.id === c.id) === idx)
              
              for (const connector of priorityConnectors) {
                if (!connector) continue
                
                try {
                  console.log(`🔌 Trying ${connector.name} (${connector.id})...`)
                  await connect({ connector })
                  
                  // Wait a bit to verify connection
                  await new Promise(resolve => setTimeout(resolve, 300))
                  
                  console.log(`✅ Connected via ${connector.name}!`)
                  // SESSİZ MOD: Bildirim kaldırıldı
                  break
                } catch (err) {
                  console.log(`⚠️ ${connector.name} failed:`, err)
                  continue
                }
              }
            } else {
              console.log('✅ Wallet already connected with correct address')
            }
          }
          
          // SESSİZ MOD: "Farcaster Identity Linked" bildirimi kaldırıldı.
          
        } else {
          console.error('❌ Quick Auth failed:', response.status)
          // Hata durumu kalsın mı? İstersen bunu da silebilirsin ama hata görmek iyidir.
          toast.error('Authentication failed', {
            description: 'Unable to verify your Farcaster identity',
          })
        }
      } catch (error) {
        console.error('❌ Quick Auth error:', error)
        // Hata durumu
        toast.error('Authentication error', {
           description: 'Connection Error'
        })
      }
    }

    authenticateUser()
  }, [isInFarcaster, isConnected, address, connectors, connect])
  
  return { isAuthenticated, farcasterAddress, userData }
}
