'use client'
import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useConnect } from 'wagmi';
import { parseUnits, type Address, type Log, decodeEventLog } from 'viem';
import { toast } from 'sonner';
import PackOpening from '@/components/PackOpening';
import MusicPanel from '@/components/MusicPanel';
import SoundCloudPlayer from '@/components/SoundCloudPlayer';
import SplashScreen from '@/components/SplashScreen';
import { sdk } from "@farcaster/miniapp-sdk";
import { useAddMiniApp } from "@/hooks/useAddMiniApp";
import { useQuickAuth } from "@/hooks/useQuickAuth";
import { useIsInFarcaster } from "@/hooks/useIsInFarcaster";

// ========================
// CONFIGURATION
// ========================
const USDC_ADDRESS: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NFT_CONTRACT_ADDRESS: Address = "0xFaCEEc3C8c67eC27c9F2afc8A4ca4a3E1e1263bC" as Address;
const IPFS_CID = "bafybeidot75pevwwcdcehtfzfwxxkwcabgyphrc6m44x2ufdestdqr5wbq"; 
const PACK_PRICE = "0.3"; 
const TOTAL_ART_COUNT = 117;

// ========================
// HELPER FUNCTIONS
// ========================
// Görsel Gösterimi için (Hızlı) - Cloudflare öncelikli
const ipfsToHttp = (uri: string): string => {
  if (!uri) return "https://i.imgur.com/hTYcwAu.png";
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
  }
  return uri;
};

// ✅ FIX: Paylaşım için En Kararlı Gateway (Cloudflare)
// Warpcast ve diğer sosyal platformlar Cloudflare gateway'i statik görsel olarak daha iyi tanır.
const ipfsToShareUrl = (uri: string): string => {
  if (!uri) return "https://i.imgur.com/hTYcwAu.png";
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
  }
  return uri;
};

// 🔄 Akıllı Görsel Hata Yönetimi
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const target = e.target as HTMLImageElement;
  const currentSrc = target.src;
  
  if (currentSrc.includes('cloudflare-ipfs.com')) {
    target.src = currentSrc.replace('cloudflare-ipfs.com', 'ipfs.io');
  } else if (currentSrc.includes('ipfs.io')) {
    target.src = currentSrc.replace('ipfs.io', 'dweb.link');
  } else if (currentSrc.includes('dweb.link')) {
    target.src = "https://placehold.co/400x600/1a1a1a/red?text=ARTIFACT+LOST";
  }
};

// ========================
// ABI DEFINITIONS
// ========================
const USDC_ABI = [
  { constant: false, inputs: [{ name: "_spender", type: "address" }, { name: "_value", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], type: "function" },
  { constant: true, inputs: [{ name: "_owner", type: "address" }, { name: "_spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }
] as const;

const NFT_ABI = [
  { inputs: [{ internalType: "uint256", name: "count", type: "uint256" }, { internalType: "string", name: "fid", type: "string" }], name: "openPacks", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { anonymous: false, inputs: [ { indexed: true, internalType: "address", name: "buyer", type: "address" }, { indexed: false, internalType: "uint256", name: "tokenId", type: "uint256" }, { indexed: false, internalType: "uint256", name: "artId", type: "uint256" }, { indexed: false, internalType: "string", name: "fid", type: "string" } ], name: "PackOpened", type: "event" }
] as const;

// ========================
// TYPES
// ========================
type MintStage = 'idle' | 'approving' | 'approved' | 'minting' | 'animating' | 'revealed' | 'gallery';

interface RevealedCard { tokenURI: string; number: number; tokenId: number; }
interface MintedNFT { id: string; image: string; tokenId?: string; artId?: number; }

// ========================
// ATMOSPHERE COMPONENTS
// ========================
const ChristmasLights = () => {
  const [activeSequence, setActiveSequence] = useState<number>(0);
  const shuffledLetters = useMemo(() => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const shuffled = [...alphabet];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const rIndex = shuffled.indexOf('R');
    const uIndex = shuffled.indexOf('U');
    [shuffled[rIndex], shuffled[uIndex]] = [shuffled[uIndex], shuffled[rIndex]];
    const nIndex = shuffled.indexOf('N');
    const cIndex = shuffled.indexOf('C');
    [shuffled[nIndex], shuffled[cIndex]] = [shuffled[cIndex], shuffled[nIndex]];
    return shuffled;
  }, []);
  
  const runIndices = useMemo(() => [shuffledLetters.indexOf('R'), shuffledLetters.indexOf('U'), shuffledLetters.indexOf('N')], [shuffledLetters]);
  
  useEffect(() => {
    const interval = setInterval(() => { setActiveSequence(prev => (prev + 1) % 3); }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-0 left-0 w-full h-20 z-50 flex justify-between px-2 md:px-3 overflow-visible pointer-events-none">
      <div className="absolute top-4 left-0 w-full h-1 bg-gray-800/50 -rotate-1"></div>
      {shuffledLetters.map((letter: string, i: number) => {
        const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
        const color = colors[i % 4];
        const isRUNActive = runIndices[activeSequence] === i;
        return (
          <div key={i} className="relative group flex flex-col items-center">
             <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${color} ${isRUNActive ? 'opacity-100 shadow-[0_0_20px_currentColor] scale-125' : 'opacity-30'} transition-all duration-300 transform translate-y-2`}></div>
             <div className="w-1 h-2 md:h-3 bg-gray-900 mx-auto -mt-1"></div>
             <span className={`text-[13px] md:text-[16px] font-mono mt-1 ${isRUNActive ? 'text-white font-bold' : 'text-white/50'} transition-all duration-300`}>{letter}</span>
          </div>
        );
      })}
    </div>
  );
};

const CreepingVines = () => (
  <div className="absolute inset-0 pointer-events-none z-10 overflow-visible">
    <svg className="absolute -bottom-10 -left-10 w-96 h-96 opacity-60 text-red-900/40 animate-pulse-slow" viewBox="0 0 100 100"><path d="M0,100 C30,90 40,60 20,40 C10,30 50,10 60,0" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M10,100 C40,80 30,50 60,60 C80,70 90,30 100,20" stroke="currentColor" strokeWidth="3" fill="none" /></svg>
    <svg className="absolute -top-10 -right-10 w-96 h-96 opacity-60 text-red-900/40 animate-pulse-slow rotate-180" viewBox="0 0 100 100"><path d="M0,100 C30,90 40,60 20,40 C10,30 50,10 60,0" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
  </div>
);

// ========================
// MAIN COMPONENT
// ========================
export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { addMiniApp } = useAddMiniApp();
  const isInFarcaster = useIsInFarcaster();
  const { isAuthenticated, farcasterAddress, userData } = useQuickAuth(isInFarcaster);
  const publicClient = usePublicClient();
  
  useEffect(() => { const tryAddMiniApp = async () => { try { await addMiniApp(); } catch (error) { console.error(error); } }; tryAddMiniApp(); }, [addMiniApp]);
  
  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (document.readyState !== 'complete') { await new Promise<void>(resolve => { if (document.readyState === 'complete') resolve(); else window.addEventListener('load', () => resolve(), { once: true }); }); }
        await sdk.actions.ready();
      } catch (error) { setTimeout(async () => { try { await sdk.actions.ready(); } catch (retryError) { console.error(retryError); } }, 1000); }
    };
    initializeFarcaster();
  }, []);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  
  // ✅ FIX: Auto-Connect Mantığı (Tamamen Sessiz - Toast Yok)
  useEffect(() => {
    const autoConnect = async () => {
      if (!isInFarcaster || isConnected) return;
      
      if (isAuthenticated && farcasterAddress) {
        // Cüzdanların yüklenmesi için güvenli bekleme
        await new Promise(resolve => setTimeout(resolve, 800));
        try {
          const injectedConnector = connectors.find((c) => c.id === 'injected' || c.type === 'injected');
          if (injectedConnector) {
             await connect({ connector: injectedConnector });
          } else if (connectors.length > 0) {
             await connect({ connector: connectors[0] });
          }
        } catch (error) { console.error('Silent auto-connect failed:', error); }
      }
    };
    autoConnect();
  }, [isInFarcaster, isAuthenticated, farcasterAddress, isConnected, connect, connectors]);

  // State
  const [packCount, setPackCount] = useState<number>(1);
  const [stage, setStage] = useState<MintStage>('idle');
  const [revealedCards, setRevealedCards] = useState<RevealedCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [userMintedNFTs, setUserMintedNFTs] = useState<MintedNFT[]>([]);
  const [communityNFTs, setCommunityNFTs] = useState<MintedNFT[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 });

  // Web3 Hooks
  const { data: usdcBalance } = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: address ? [address] : undefined });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'allowance', args: address ? [address, NFT_CONTRACT_ADDRESS] : undefined });
  const { data: totalSupply } = useReadContract({ address: NFT_CONTRACT_ADDRESS, abi: NFT_ABI, functionName: 'totalSupply' });
  const { data: approveHash, writeContract: approveWrite, error: approveError } = useWriteContract();
  const { data: mintHash, writeContract: mintWrite, error: mintError } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed, data: mintReceipt } = useWaitForTransactionReceipt({ hash: mintHash });

  const totalCost = useMemo(() => parseUnits((parseFloat(PACK_PRICE) * packCount).toString(), 6), [packCount]);
  const hasEnoughBalance = useMemo(() => usdcBalance ? (usdcBalance as bigint) >= totalCost : false, [usdcBalance, totalCost]);
  const needsApproval = useMemo(() => allowance ? (allowance as bigint) < totalCost : true, [allowance, totalCost]);

  // Galeri Mantığı
  const galleryItems = useMemo(() => {
    const groupedItems: Record<number, { count: number, image: string, artId: number }> = {};
    userMintedNFTs.forEach(nft => {
      let artId = nft.artId;
      if (!artId && nft.image) {
         const match = nft.image.match(/\/(\d+)\.png$/);
         if (match) artId = Number(match[1]);
      }
      if (artId) {
        if (!groupedItems[artId]) groupedItems[artId] = { count: 0, image: nft.image, artId: artId };
        groupedItems[artId].count += 1;
      }
    });
    return Object.values(groupedItems).sort((a, b) => a.artId - b.artId);
  }, [userMintedNFTs]);

  const uniqueCollectedCount = galleryItems.length;

  useEffect(() => {
    setMousePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    const handleTouchMove = (e: TouchEvent) => { if (e.touches.length > 0) setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY }); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('touchmove', handleTouchMove); };
  }, []);

  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`nfts_${address}`);
      if (stored) try { setUserMintedNFTs(JSON.parse(stored)); } catch (e) { console.error(e); }
    }
  }, [address]);

  useEffect(() => {
    const fetchRecentMints = async (): Promise<void> => {
      if (!publicClient || !totalSupply || typeof totalSupply !== 'bigint') return;
      try {
        const supply = Number(totalSupply);
        if (supply === 0) return;
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(1000);
        const logs = await publicClient.getLogs({ address: NFT_CONTRACT_ADDRESS, event: { type: 'event', name: 'PackOpened', inputs: [ { indexed: true, name: 'buyer', type: 'address' }, { indexed: false, name: 'tokenId', type: 'uint256' }, { indexed: false, name: 'artId', type: 'uint256' }, { indexed: false, name: 'fid', type: 'string' } ] }, fromBlock, toBlock: 'latest' });
        
        if (logs.length === 0) {
          const nfts: MintedNFT[] = [];
          const startId = Math.max(1, supply - 9);
          for (let i = supply; i >= startId; i--) { nfts.push({ id: `community-${i}`, image: `ipfs://${IPFS_CID}/${(i % TOTAL_ART_COUNT) || TOTAL_ART_COUNT}.png`, tokenId: i.toString() }); }
          setCommunityNFTs(nfts);
          return;
        }
        
        const mintedNFTs = logs.map((log) => {
            try {
              const decoded = decodeEventLog({ abi: NFT_ABI, data: log.data, topics: log.topics });
              const args = decoded.args as { buyer: Address; tokenId: bigint; artId: bigint; fid: string };
              return { id: `community-${args.tokenId}`, image: `ipfs://${IPFS_CID}/${args.artId}.png`, tokenId: args.tokenId.toString(), artId: Number(args.artId) };
            } catch (error) { return null; }
          }).filter((nft) => nft !== null).reverse().slice(0, 10);
        
        if (mintedNFTs.length < 10 && supply > 0) {
           const remaining = 10 - mintedNFTs.length;
           const fallbackNFTs: MintedNFT[] = [];
           const startId = Math.max(1, supply - remaining + 1);
           for (let i = supply; i >= startId && fallbackNFTs.length < remaining; i--) {
             if (!mintedNFTs.find(nft => nft?.tokenId === i.toString())) {
               fallbackNFTs.push({ id: `community-${i}`, image: `ipfs://${IPFS_CID}/${(i % TOTAL_ART_COUNT) || TOTAL_ART_COUNT}.png`, tokenId: i.toString() });
             }
           }
           setCommunityNFTs([...(mintedNFTs as MintedNFT[]), ...fallbackNFTs].slice(0, 10));
        } else {
           setCommunityNFTs(mintedNFTs as MintedNFT[]);
        }
      } catch (error) { console.error(error); }
    };
    const timer = setTimeout(() => { fetchRecentMints(); }, 2000);
    return () => clearTimeout(timer);
  }, [totalSupply, publicClient]);

  // Transaction Management
  useEffect(() => { 
    if (isApproveConfirmed && stage === 'approving') { setStage('approved'); refetchAllowance(); setTimeout(() => { handleMint(); }, 500); } 
  }, [isApproveConfirmed, stage, refetchAllowance]);

  useEffect(() => { if (approveError && stage === 'approving') { console.error(approveError); setStage('idle'); } }, [approveError, stage]);
  useEffect(() => { if (mintError && stage === 'minting') { console.error(mintError); setStage('idle'); toast.error('Mint Failed'); } }, [mintError, stage]);

  useEffect(() => {
    if (isMintConfirmed && mintReceipt && stage === 'minting' && address) {
      const processEvents = async (): Promise<void> => {
        try {
          const packOpenedEvents = mintReceipt.logs.filter((log: Log) => {
              try { return decodeEventLog({ abi: NFT_ABI, data: log.data, topics: log.topics }).eventName === 'PackOpened'; } catch { return false; }
            }).map((log: Log) => decodeEventLog({ abi: NFT_ABI, data: log.data, topics: log.topics }).args as { buyer: Address; tokenId: bigint; artId: bigint; fid: string });

          if (packOpenedEvents.length === 0) { setStage('idle'); return; }

          const cards: RevealedCard[] = packOpenedEvents.map((event) => ({ tokenURI: `ipfs://${IPFS_CID}/${Number(event.artId)}.png`, number: Number(event.artId), tokenId: Number(event.tokenId) }));
          setRevealedCards(cards);
          setCurrentCardIndex(0);
          setStage('animating');

          const newNFTs: MintedNFT[] = cards.map((card) => ({ id: `${card.tokenId}`, image: card.tokenURI, tokenId: card.tokenId.toString(), artId: card.number }));
          const stored = localStorage.getItem(`nfts_${address}`);
          const existing: MintedNFT[] = stored ? JSON.parse(stored) : [];
          const updated = [...newNFTs, ...existing];
          localStorage.setItem(`nfts_${address}`, JSON.stringify(updated));
          setUserMintedNFTs(updated);
        } catch (error) { console.error(error); setStage('idle'); }
      };
      processEvents();
    }
  }, [isMintConfirmed, mintReceipt, stage, address]);

  const handleApprove = (): void => {
    if (!isConnected || !address) return;
    if (!hasEnoughBalance) { toast.error("Insufficient Funds"); return; }
    setStage('approving');
    approveWrite({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'approve', args: [NFT_CONTRACT_ADDRESS, totalCost] });
  };

  const handleMint = (): void => {
    if (!isConnected || !address) return;
    const fid: string = userData?.fid?.toString() || address.slice(2, 10);
    setStage('minting');
    mintWrite({ address: NFT_CONTRACT_ADDRESS, abi: NFT_ABI, functionName: 'openPacks', args: [BigInt(packCount), fid] });
  };

  // ✅ FIX: Gelişmiş Bağlanma Fonksiyonu (Retry Mekanizması)
  // Connectors dizisi boş gelirse, birkaç kez yeniden dener.
  const handleConnectWallet = async () => {
    const tryConnect = async (attempt = 1) => {
        try {
            // Önce connectors listesi dolu mu kontrol et
            if (connectors.length === 0) {
                if (attempt <= 3) {
                    // Cüzdan adaptörleri yükleniyor olabilir, biraz bekle ve tekrar dene
                    // console.log(`Wallet adapters not ready, retrying... (${attempt}/3)`);
                    setTimeout(() => tryConnect(attempt + 1), 500);
                    return;
                }
                toast.error("Wallet provider not found. Please refresh.");
                return;
            }

            const injected = connectors.find(c => c.id === 'injected' || c.type === 'injected');
            if (injected) {
                await connect({ connector: injected });
            } else {
                await connect({ connector: connectors[0] });
            }
        } catch (e) {
            console.error("Connection error:", e);
            if (attempt <= 2) {
                 setTimeout(() => tryConnect(attempt + 1), 500);
            } else {
                 toast.error('Connection failed.');
            }
        }
    };

    await tryConnect();
  };

  const handleOpenPack = async (): Promise<void> => {
    if (stage !== 'idle' && stage !== 'approved') return;
    if (!isInFarcaster) { alert('This app is only available inside Farcaster.'); return; }
    
    // Bağlı değilse, retry mekanizmalı bağlanma fonksiyonunu çağır
    if (!isConnected || !address) {
      await handleConnectWallet();
      return;
    }
    
    if (needsApproval) handleApprove(); else handleMint();
  };

  const handleAnimationComplete = (): void => {
    if (currentCardIndex < revealedCards.length - 1) { setCurrentCardIndex(prev => prev + 1); } else { setStage('revealed'); }
  };

  const handleContinue = (): void => { setStage('idle'); setRevealedCards([]); setCurrentCardIndex(0); setPackCount(1); };
  const handleSkipToReveal = (): void => { setStage('revealed'); };

  // ✅ FIX: Share URL Artık Cloudflare kullanıyor (Görsel Garantisi İçin)
  const handleShare = async (customText?: string, customImage?: string) => {
    setIsLoading(true);
    try {
        let shareText = customText || `Just minted ${revealedCards.length} Stranger Things NFT${revealedCards.length > 1 ? 's' : ''} from the Upside Down! 🔴⚡\n\n${revealedCards.map(c => `📄 Artifact #${c.number}`).join('\n')}\n\nExperience: https://voltpacks.xyz\n\n#StrangerThings #NFT #Base`;
        
        let rawImage = customImage || (revealedCards.length > 0 ? revealedCards[0].tokenURI : "https://i.imgur.com/hTYcwAu.png");
        let embedImage = ipfsToShareUrl(rawImage);
        
        const encodedText = encodeURIComponent(shareText);
        const encodedEmbed = encodeURIComponent(embedImage);
        
        const url = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedEmbed}`;
        
        if (isInFarcaster) {
            await sdk.actions.openUrl(url);
        } else {
            window.open(url, '_blank');
        }
    } catch (e) {
        console.error("Share failed", e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleShareCollection = () => {
     const shareText = `I have collected ${uniqueCollectedCount} / ${TOTAL_ART_COUNT} unique artifacts from the Upside Down! 🔴⚡\n\nCan you beat my collection?\n\nMint yours at: https://voltpacks.xyz`;
     const lastItem = galleryItems.length > 0 ? galleryItems[galleryItems.length - 1] : null;
     const embedImage = lastItem ? lastItem.image : "https://i.imgur.com/hTYcwAu.png";
     handleShare(shareText, embedImage);
  };

  const handleShareSingleNFT = (nft: { artId: number, image: string }) => {
      const shareText = `Check out Artifact #${nft.artId} I found in the Upside Down! 🔦\n\nMint yours at: https://voltpacks.xyz`;
      handleShare(shareText, nft.image);
  };

  if (stage === 'animating' && revealedCards[currentCardIndex]) {
    return <PackOpening cardImage={revealedCards[currentCardIndex].tokenURI} cardNumber={currentCardIndex + 1} totalCards={revealedCards.length} onAnimationComplete={handleAnimationComplete} onSkip={handleSkipToReveal} />;
  }

  // GALLERY SCREEN
  if (stage === 'gallery') {
    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center font-sans relative overflow-x-hidden selection:bg-red-500 selection:text-black">
             <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#4a0000_0%,#000000_70%)] opacity-80"></div>
                <div className="absolute inset-0 bg-red-600/5 animate-pulse-slow mix-blend-color-dodge"></div>
            </div>
            
            <div className="relative z-10 w-full max-w-7xl px-4 pt-10 pb-40 flex flex-col items-center">
                <div className="text-center mb-8">
                    <h2 className="text-4xl md:text-6xl text-red-600 font-bold mb-2 tracking-tighter drop-shadow-[0_2px_10px_rgba(255,0,0,0.8)]" style={{ fontFamily: 'ITC Benguiat, serif' }}>MY COLLECTION</h2>
                    <p className="text-gray-400 font-mono tracking-widest text-sm mb-2">
                        PROGRESS: <span className="text-white font-bold text-lg">{uniqueCollectedCount}</span> / {TOTAL_ART_COUNT}
                    </p>
                    <div className="w-64 h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-700 relative mx-auto shadow-[0_0_15px_rgba(255,0,0,0.3)]">
                        <div className="absolute inset-0 bg-red-900/30"></div>
                        <div className="h-full bg-gradient-to-r from-red-800 to-red-500 shadow-[0_0_10px_red]" style={{ width: `${(uniqueCollectedCount / TOTAL_ART_COUNT) * 100}%` }}></div>
                    </div>
                </div>

                {galleryItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <p className="text-red-500 font-mono text-xl">NO ARTIFACTS FOUND</p>
                        <p className="text-gray-500 text-sm mt-2">Open packs to start collecting</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                        {galleryItems.map((item, idx) => (
                             <div key={`${item.artId}-${idx}`} className="relative aspect-[2/3] bg-gray-900 rounded border border-gray-800 overflow-hidden group hover:border-red-500 transition-all duration-300 shadow-lg">
                                {item.count > 1 && (
                                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg z-30 border border-red-400 animate-pulse">
                                        {item.count}X
                                    </div>
                                )}
                                <div className="absolute top-1 left-1 bg-black/80 px-2 py-0.5 rounded text-[8px] text-white font-mono z-20 border border-gray-700">#{item.artId}</div>
                                <img src={ipfsToHttp(item.image)} alt={`Artifact`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" onError={handleImageError} />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-40 backdrop-blur-[1px]">
                                    <button onClick={() => handleShareSingleNFT(item)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded border border-red-400 transform scale-90 hover:scale-100 transition-transform uppercase tracking-wider">
                                        SHARE CARD
                                    </button>
                                </div>
                             </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
                 <div className="absolute bottom-0 w-full h-40 bg-gradient-to-t from-black via-black/90 to-transparent"></div>
                 <div className="relative w-full pb-6 flex flex-col sm:flex-row justify-center items-center gap-4 h-auto pointer-events-auto px-4">
                     <button onClick={handleShareCollection} className="px-6 py-3 bg-black border-2 border-purple-800 text-purple-400 font-bold uppercase hover:text-white hover:border-purple-500 transition-all skew-x-[-10deg]">
                        <span className="skew-x-[10deg]">SHARE ALL</span>
                     </button>
                     <button onClick={() => setStage('idle')} className="px-8 py-3 bg-black border-2 border-red-800 text-red-600 font-bold uppercase hover:text-white hover:border-red-500 transition-all skew-x-[-10deg]">
                        <span className="skew-x-[10deg]">RETURN</span>
                     </button>
                 </div>
            </div>
        </div>
    );
  }

  // REVEALED SCREEN
  if (stage === 'revealed') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center font-sans relative overflow-x-hidden selection:bg-red-500 selection:text-black">
        <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#4a0000_0%,#000000_70%)] opacity-80"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-red-600/5 animate-pulse-slow mix-blend-color-dodge"></div>
        </div>

        <div className="relative z-10 w-full max-w-6xl px-3 pt-10 md:pt-12 pb-24 md:pb-32 flex flex-col items-center">
           <div className="relative mb-10 md:mb-16 group text-center">
              <div className="absolute -inset-5 md:-inset-8 bg-red-600/30 blur-[32px] md:blur-[48px] opacity-50 group-hover:opacity-100 transition duration-1000"></div>
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-[#ff0000] via-[#aa0000] to-black tracking-tighter scale-y-90 drop-shadow-[0_3px_8px_rgba(255,0,0,0.8)] px-3" style={{ fontFamily: 'ITC Benguiat, serif', WebkitTextStroke: '1px #ff0000' }}>Welcome To<br/>Hawkins</h1>
              <div className="w-full h-[2px] bg-red-600/50 mt-2 md:mt-3 shadow-[0_0_16px_red]"></div>
              <p className="text-red-400 font-mono text-[8px] sm:text-[10px] tracking-[0.4em] sm:tracking-[0.6em] md:tracking-[0.8em] uppercase mt-2 md:mt-3 opacity-80 animate-pulse">Artifacts Recovered</p>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10 w-full perspective-grid">
            {revealedCards.map((card, idx) => (
              <div key={idx} className="group relative flex flex-col items-center" style={{ animation: `fade-in-up 0.8s ease-out ${idx * 0.15}s backwards` }}>
                <div className="relative w-full max-w-[280px] mx-auto h-[350px] sm:h-[380px] md:h-[420px] transition-all duration-500 transform-style-3d group-hover:rotate-x-6 group-hover:rotate-y-6 group-hover:scale-105">
                  <div className="absolute -inset-[2px] bg-gradient-to-b from-red-500 to-black rounded-lg blur opacity-20 group-hover:opacity-100 transition duration-500"></div>
                  <div className="relative w-full h-full bg-[#111] border border-red-900/60 rounded-lg overflow-hidden shadow-2xl flex flex-col">
                    <div className="h-7 sm:h-8 bg-[#1a0505] border-b border-red-900/30 flex items-center justify-between px-2 sm:px-3">
                        <div className="flex gap-1 sm:gap-1.5"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-600 animate-pulse"></div><span className="text-[8px] sm:text-[10px] text-red-500 font-mono tracking-wider sm:tracking-widest">CONFIDENTIAL</span></div>
                        <span className="text-[8px] sm:text-[10px] text-gray-500 font-mono">TOKEN #{card.tokenId}</span>
                    </div>
                    <div className="relative flex-1 bg-black overflow-hidden group-hover:brightness-110 transition duration-500">
                        <div className="absolute inset-0 z-20 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%]"></div>
                        <img src={ipfsToHttp(card.tokenURI)} alt={`Artifact ${card.number}`} className="w-full h-full object-cover opacity-90 grayscale group-hover:grayscale-0 transition-all duration-700" onError={handleImageError} />
                        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#111] to-transparent z-10"></div>
                    </div>
                    <div className="h-16 sm:h-20 bg-[#0a0a0a] p-2 sm:p-3 relative z-20 border-t border-red-900/30">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-900 text-white text-[7px] sm:text-[8px] font-bold px-1.5 sm:px-2 py-0.5 rounded shadow-lg border border-red-500">ART #{card.number}</div>
                        <div className="flex justify-between mt-3 sm:mt-5 text-[7px] sm:text-[8px] text-gray-500 font-mono uppercase tracking-wider sm:tracking-widest"><span>Origin: Upside Down</span><span>Status: Recovered</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
             <div className="absolute bottom-0 w-full h-40 md:h-52 bg-gradient-to-t from-black via-black/90 to-transparent"></div>
             <div className="relative w-full pb-5 md:pb-8 flex flex-col sm:flex-row justify-center items-center gap-3 h-auto pointer-events-auto px-3">
                 <button onClick={() => handleShare()} className="group relative px-5 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 bg-black border-2 border-purple-800 text-purple-500 font-bold text-sm sm:text-base md:text-lg tracking-[0.12em] sm:tracking-[0.16em] uppercase transition-all duration-300 hover:text-white hover:border-purple-500 overflow-hidden skew-x-[-10deg]">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out skew-x-[10deg] origin-bottom"></div>
                    <span className="relative z-10 flex items-center gap-1.5 sm:gap-2 skew-x-[10deg] text-center">
                        <span className="hidden md:inline">SHARE ON FARCASTER</span>
                        <span className="md:hidden">SHARE</span>
                    </span>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 shadow-[0_0_30px_rgba(168,85,247,0.6)]"></div>
                 </button>

                 <button onClick={handleContinue} className="group relative px-6 sm:px-8 md:px-10 py-2 sm:py-3 md:py-4 bg-black border-2 border-red-800 text-red-600 font-bold text-sm sm:text-base md:text-lg tracking-[0.12em] sm:tracking-[0.16em] uppercase transition-all duration-300 hover:text-white hover:border-red-500 overflow-hidden skew-x-[-10deg]">
                    <div className="absolute inset-0 bg-red-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out skew-x-[10deg] origin-bottom"></div>
                    <span className="relative z-10 flex items-center gap-2 sm:gap-3 skew-x-[10deg] text-center">
                        <span className="hidden sm:inline">RETURN TO THE GATE</span>
                        <span className="sm:hidden">RETURN</span>
                    </span>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 shadow-[0_0_30px_rgba(255,0,0,0.6)]"></div>
                 </button>
             </div>
        </div>
        <CreepingVines />
      </div>
    );
  }

  // RENDER: IDLE (MAIN)
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans selection:bg-red-900 selection:text-white cursor-crosshair">
      <div className="pointer-events-none fixed inset-0 z-25 transition-opacity duration-300" style={{ background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.98) 100%)` }}></div>
      <div className="fixed inset-0 z-20 pointer-events-none opacity-10 bg-[url('https://upload.wikimedia.org/wikipedia/commons/7/76/Noise_tv.png')] animate-grain"></div>
      <div className="fixed inset-0 z-20 pointer-events-none bg-gradient-to-b from-transparent via-red-900/5 to-transparent bg-[length:100%_4px] animate-scanline opacity-20"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1a0505_0%,#050101_100%)] z-0"></div>
      <CreepingVines />
      <ChristmasLights />
      {[...Array(10)].map((_, i) => ( <div key={i} className="spore-particle z-10" style={{ left: `${Math.random() * 100}%`, width: Math.random() * 4 + 1 + 'px', height: Math.random() * 4 + 1 + 'px', animationDelay: `${Math.random() * 5}s`, animationDuration: `${10 + Math.random() * 10}s`, opacity: Math.random() * 0.7 }} /> ))}

      <div className="relative z-40 min-h-screen flex flex-col items-center justify-center p-4 pt-24 md:pt-20">
        <div className="relative mb-6 md:mb-10 group">
          <div className="absolute -inset-5 md:-inset-8 bg-red-600/20 blur-[48px] md:blur-[80px] animate-pulse-slow group-hover:bg-red-600/30 transition-all duration-500"></div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 tracking-tighter drop-shadow-[0_0_24px_rgba(255,0,0,0.8)] scale-y-90" style={{ fontFamily: 'ITC Benguiat, serif', textShadow: '0 4px 20px rgba(200, 0, 0, 0.5)' }}>STRANGER <br/> CARDS</h1>
          <div className="absolute top-0 left-0 w-full h-full border-t border-b border-red-900/30 scale-x-125 pointer-events-none"></div>
          <p className="text-red-500 font-mono text-[10px] sm:text-xs md:text-sm tracking-[0.4em] md:tracking-[0.6em] text-center mt-2 md:mt-3 animate-flicker uppercase opacity-80">Upside Down Artifacts</p>
        </div>

        <div className="relative group perspective-card mb-6 md:mb-10">
          {[...Array(8)].map((_, i) => ( <div key={i} className="absolute w-2 h-2 bg-red-500/60 rounded-full animate-float-particle" style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, animationDelay: `${i * 0.5}s`, animationDuration: `${3 + Math.random() * 2}s` }} /> ))}
          <div className="relative w-52 h-64 sm:w-60 sm:h-80 md:w-64 md:h-[380px] transition-transform duration-500 transform-style-3d group-hover:rotate-y-6 group-hover:rotate-x-6 animate-float-card">
            <div className="absolute -inset-4 bg-red-600/30 rounded-full blur-2xl group-hover:bg-red-600/50 animate-pulse transition-all"></div>
            <div className="relative w-full h-full bg-[#0a0a0a] border-[3px] border-red-800/80 rounded-lg shadow-[0_0_60px_rgba(139,0,0,0.3)] flex flex-col items-center justify-center overflow-hidden animate-card-glow">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-60 mix-blend-overlay"></div>
               <div className="absolute inset-0 bg-gradient-to-t from-red-900/40 via-transparent to-black/80"></div>
               <svg className="absolute inset-0 w-full h-full opacity-40 mix-blend-color-dodge" viewBox="0 0 100 100" preserveAspectRatio="none">
                 <path d="M50,110 Q10,70 50,50 T50,-10" stroke="#ff0000" strokeWidth="1" fill="none" className="animate-pulse-slow" />
               </svg>
               <div className="relative z-10 text-center transform group-hover:scale-105 transition-transform">
                 <div className="text-[10px] text-red-500 tracking-[0.24em] mb-1.5 font-mono animate-pulse">WARNING: HAZARDOUS</div>
                 <h2 className="text-4xl font-extrabold text-red-600 tracking-tighter drop-shadow-[0_2px_8px_rgba(0,0,0,1)] animate-text-glow" style={{ fontFamily: 'ITC Benguiat, serif' }}>MYSTERY<br/>PACK</h2>
               </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 md:gap-5 w-full max-w-sm z-50 px-3">
           <div className="flex items-center gap-3 sm:gap-5 bg-black/50 p-1.5 rounded-xl border border-red-900/30 backdrop-blur-sm">
              <button onClick={() => setPackCount(Math.max(1, packCount - 1))} disabled={stage !== 'idle'} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-900/50 rounded-lg text-lg sm:text-xl font-bold transition-all border border-red-900/30">-</button>
              <div className="text-center w-16 sm:w-20"><span className="text-xl sm:text-2xl font-bold text-white drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">{packCount}</span><div className="text-[8px] sm:text-[9px] text-gray-500 font-mono tracking-widest uppercase">PACKS</div></div>
              <button onClick={() => setPackCount(packCount + 1)} disabled={stage !== 'idle'} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-900/50 rounded-lg text-lg sm:text-xl font-bold transition-all border border-red-900/30">+</button>
           </div>

           <button onClick={handleOpenPack} disabled={stage !== 'idle' && stage !== 'approved'} className={`relative w-full py-3 sm:py-4 md:py-5 px-5 sm:px-6 font-bold text-sm sm:text-base md:text-lg tracking-[0.12em] sm:tracking-[0.16em] uppercase transition-all duration-300 group overflow-hidden rounded-sm pointer-events-auto ${(stage !== 'idle' && stage !== 'approved') ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-wait' : !isConnected ? 'bg-gray-900 text-gray-500 border border-gray-700 cursor-pointer hover:bg-gray-800 hover:text-gray-400' : 'bg-red-900/20 text-red-500 border border-red-600 hover:bg-red-600 hover:text-black hover:shadow-[0_0_50px_rgba(255,0,0,0.6)] cursor-pointer'}`}>
            <div className="absolute inset-0 bg-red-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
            <span className="relative z-10 flex items-center justify-center gap-2">
               {stage === 'approving' ? <span className="animate-pulse">AWAITING APPROVAL...</span> : isApproveConfirming ? <span className="animate-pulse">CONFIRMING APPROVAL...</span> : stage === 'minting' ? <span className="animate-pulse">OPENING PACK...</span> : isMintConfirming ? <span className="animate-pulse">MINTING...</span> : !isConnected ? (isInFarcaster && isAuthenticated && userData ? <span className="flex flex-col items-center gap-0.5"><span className="text-sm">CONNECT WALLET</span><span className="text-[10px] opacity-70">@{userData.username}</span></span> : isInFarcaster ? 'CONNECT WALLET' : 'OPEN IN FARCASTER') : needsApproval ? 'APPROVE' : 'OPEN PACK'}
            </span>
          </button>
          
          <button onClick={() => setStage('gallery')} className="text-gray-500 text-xs hover:text-white font-mono tracking-widest border-b border-transparent hover:border-red-500 transition-all uppercase mt-2">
             SEE YOUR COLLECTION ({uniqueCollectedCount}/{TOTAL_ART_COUNT})
          </button>

          <div className="text-[8px] sm:text-[10px] text-red-900/80 font-mono tracking-wider sm:tracking-widest text-center mt-1">TOTAL FLUX: {(parseFloat(PACK_PRICE) * packCount).toFixed(2)} USDC</div>
        </div>

        {communityNFTs.length > 0 && (
          <div className="mt-12 md:mt-20 w-full border-t border-red-900/20 pt-6 md:pt-10 relative">
            <h3 className="text-center text-red-800 font-mono text-[10px] sm:text-xs tracking-[0.24em] sm:tracking-[0.4em] mb-5 md:mb-6 uppercase animate-pulse">Recent Discoveries</h3>
            <div className="relative overflow-hidden mask-linear-fade">
              <div className="flex gap-5 animate-scroll-left hover:[animation-play-state:paused] py-3">
                {[...communityNFTs, ...communityNFTs].map((nft: MintedNFT, idx: number) => (
                  <div key={`${nft.id}-${idx}`} className="flex-shrink-0 w-32 group cursor-pointer">
                    <div className="relative aspect-[2/3] bg-gray-900 rounded border border-gray-800 overflow-hidden transform group-hover:-translate-y-2 transition-transform duration-300 shadow-lg">
                       <img src={ipfsToHttp(nft.image)} alt={`Token #${nft.tokenId}`} loading="lazy" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all duration-500" onError={handleImageError} />
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                       <div className="absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2 bg-white text-black text-[8px] sm:text-[10px] font-mono px-1 transform -rotate-2">{nft.artId ? `ART_${nft.artId}` : `TOK_${nft.tokenId}`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoading && <SplashScreen finishLoading={() => setIsLoading(false)} />}
      <MusicPanel />
      <SoundCloudPlayer />
    </div>
  );
}
