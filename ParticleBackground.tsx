import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useScroll, useTransform, useVelocity } from 'motion/react';
import { Plus, Send, Play, Pause, Trash2, Edit2, MousePointer2, Sparkles, LogIn, LogOut, User, Loader2, Video, MessageSquare, UserPlus, Quote, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { generateCaseStudy } from './services/geminiService';
import { auth, db, storage, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { ParticleBackground } from './components/ParticleBackground';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Project {
  id: string;
  title: string;
  type: string;
  url: string;
  size?: string;
  description?: string;
  createdAt?: any;
  authorUid?: string;
}

interface Reel {
  id: string;
  title: string;
  url: string;
  createdAt?: any;
}

interface Review {
  id: string;
  name: string;
  pfp: string;
  text: string;
  role?: string;
  createdAt?: any;
}

const FALLBACK_VIDEO = "https://assets.mixkit.co/videos/preview/mixkit-abstract-flowing-purple-and-blue-gradient-background-23424-large.mp4";

// --- SUB-COMPONENTS ---

const ReelMarquee = ({ reels, isAdmin, onRemove, onEdit }: { reels: Reel[], isAdmin: boolean, onRemove: (id: string) => void, onEdit: (id: string, title: string) => void }) => {
  return (
    <section className="py-20 overflow-hidden relative z-10">
      <div className="px-8 mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">Vertical <span className="text-purple-600">Reels</span></h2>
          <p className="text-white/40 text-xs mt-2 tracking-widest uppercase">High-impact short-form content</p>
        </div>
      </div>
      
      {/* Container with mask for "dissolve" effect */}
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
        <div className="flex gap-6 animate-marquee whitespace-nowrap w-max">
          {[...reels, ...reels, ...reels].map((reel, idx) => (
            <motion.div 
              key={`${reel.id}-${idx}`}
              className="relative w-[280px] aspect-[9/16] bg-[#111] rounded-3xl overflow-hidden border border-white/5 flex-shrink-0 group"
            >
              <video 
                src={reel.url || FALLBACK_VIDEO} 
                autoPlay 
                muted 
                loop 
                playsInline 
                className="w-full h-full object-cover opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-out"
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  if (target.src !== FALLBACK_VIDEO) {
                    target.src = FALLBACK_VIDEO;
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 flex flex-col justify-end">
                <h3 className="text-sm font-bold tracking-tight">{reel.title}</h3>
                {isAdmin && (
                  <button 
                    onClick={() => onEdit(reel.id, reel.title)}
                    className="mt-2 text-[10px] text-purple-400 hover:underline uppercase tracking-widest font-bold text-left"
                  >
                    Edit Title
                  </button>
                )}
              </div>
              {isAdmin && (
                <button 
                  onClick={() => onRemove(reel.id)}
                  className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500 text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
};

const BubbleCloud = ({ reviews }: { reviews: Review[] }) => {
  return (
    <div className="relative h-[400px] w-full flex items-center justify-center overflow-hidden">
      {reviews.map((review, idx) => (
        <motion.div
          key={review.id}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ delay: idx * 0.1, type: "spring" }}
          drag
          dragConstraints={{ left: -200, right: 200, top: -100, bottom: 100 }}
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: `${30 + (idx % 4) * 15}%`,
            top: `${20 + (idx % 3) * 25}%`,
          }}
        >
          <motion.div 
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 4 + idx, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="relative group"
          >
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-purple-500/30 group-hover:border-purple-500 transition-colors shadow-2xl shadow-purple-500/20">
              <img src={review.pfp} alt={review.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-purple-600 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <Quote size={10} className="text-white" />
            </div>
            
            {/* Tooltip-like review snippet */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-48 p-3 bg-[#111]/90 backdrop-blur-md border border-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
              <p className="text-[10px] text-white/80 italic leading-relaxed">"{review.text.substring(0, 60)}..."</p>
              <p className="text-[8px] font-bold mt-2 text-purple-400 uppercase tracking-widest">{review.name}</p>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
};

const CustomVideoPlayer = ({ src, poster }: { src: string, poster?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div 
      className="relative group w-full h-full bg-black overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src || FALLBACK_VIDEO}
        poster={poster}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        autoPlay
        playsInline
        onError={(e) => {
          const target = e.target as HTMLVideoElement;
          if (target.src !== FALLBACK_VIDEO) {
            target.src = FALLBACK_VIDEO;
          }
        }}
      />

      {/* Overlay Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20"
          >
            {/* Seek Bar */}
            <div className="relative w-full h-1.5 bg-white/10 rounded-full mb-6 group/seek">
              <div 
                className="absolute top-0 left-0 h-full bg-purple-600 rounded-full z-10"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <input 
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-xl scale-0 group-hover/seek:scale-100 transition-transform z-30 pointer-events-none"
                style={{ left: `${(currentTime / duration) * 100}%`, transform: `translate(-50%, -50%)` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button onClick={togglePlay} className="text-white hover:text-purple-500 transition-colors">
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                </button>

                <div className="flex items-center gap-3 group/volume">
                  <button onClick={toggleMute} className="text-white hover:text-purple-500 transition-colors">
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300">
                    <input 
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>

                <div className="text-[10px] font-mono text-white/60 tracking-widest">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => videoRef.current?.requestFullscreen()}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <Maximize size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big Play Button Overlay on Pause */}
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
          onClick={togglePlay}
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-full bg-purple-600/20 border border-purple-500/50 backdrop-blur-md flex items-center justify-center text-white"
          >
            <Play size={32} fill="currentColor" className="ml-1" />
          </motion.div>
        </div>
      )}
    </div>
  );
};

const ClientReviews = ({ reviews, isAdmin, onRemove, onAdd, onEdit }: { reviews: Review[], isAdmin: boolean, onRemove: (id: string) => void, onAdd: () => void, onEdit: (id: string, review: Review) => void }) => {
  return (
    <section className="py-20 px-8 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-16">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase italic">Client <span className="text-purple-600">Voices</span></h2>
            <p className="text-white/40 text-xs mt-2 tracking-widest uppercase">What they say about the stack</p>
          </div>
          {isAdmin && (
            <button 
              onClick={onAdd}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              <UserPlus size={14} /> Add Review
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <BubbleCloud reviews={reviews} />
          
          <div className="space-y-6">
            {reviews.slice(0, 3).map((review, idx) => (
              <motion.div 
                key={review.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
                className="p-8 bg-white/5 border border-white/5 rounded-3xl relative group"
              >
                <Quote className="absolute top-6 right-8 text-purple-600/20 group-hover:text-purple-600/40 transition-colors" size={40} />
                <p className="text-lg text-white/80 italic leading-relaxed relative z-10">
                  "{review.text}"
                </p>
                <div className="mt-8 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                    <img src={review.pfp} alt={review.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-tight">{review.name}</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">{review.role}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => onEdit(review.id, review)}
                      className="p-2 text-white/20 hover:text-purple-500 transition-colors"
                    >
                      <Sparkles size={14} />
                    </button>
                    <button 
                      onClick={() => onRemove(review.id)}
                      className="p-2 text-white/20 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const App = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [reviewForm, setReviewForm] = useState({ name: '', role: '', text: '', pfp: '' });
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({ title: '', description: '', size: 'medium' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewPfpInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check if user is admin (default admin in rules is editsbyabhinav98@gmail.com)
        // We also check the users collection for role
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data().role === 'admin');
          } else {
            // Create viewer profile by default
            const isAdminEmail = user.email === "editsbyabhinav98@gmail.com" || user.email === "maharakhlesh38@gmail.com";
            const role = isAdminEmail ? 'admin' : 'viewer';
            try {
              await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                role: role
              });
              setIsAdmin(role === 'admin');
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
            }
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          // Fallback to email check if doc read fails (rules will still protect)
          const isAdminEmail = user.email === "editsbyabhinav98@gmail.com" || user.email === "maharakhlesh38@gmail.com";
          setIsAdmin(isAdminEmail);
          if (error instanceof Error && !error.message.includes('permission')) {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Projects Listener
  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Project[];
      setProjects(projectsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });
    return () => unsubscribe();
  }, []);

  // Firestore Reels Listener
  useEffect(() => {
    const q = query(collection(db, 'reels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reelsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Reel[];
      setReels(reelsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reels');
    });
    return () => unsubscribe();
  }, []);

  // Firestore Reviews Listener
  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Review[];
      setReviews(reviewsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reviews');
    });
    return () => unsubscribe();
  }, []);

  // Custom Cursor Logic with Motion Values for performance
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  // Scroll-driven animations
  const { scrollY, scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.8]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 500], [0, 100]);
  
  const bgMeshY1 = useTransform(scrollY, [0, 1000], [0, -200]);
  const bgMeshY2 = useTransform(scrollY, [0, 1000], [0, 200]);
  const bgMeshY3 = useTransform(scrollY, [0, 1000], [0, -100]);

  const navBg = useTransform(scrollY, [0, 100], ["rgba(5, 5, 5, 0)", "rgba(5, 5, 5, 0.8)"]);
  const navBlur = useTransform(scrollY, [0, 100], ["blur(0px)", "blur(12px)"]);
  const navBorder = useTransform(scrollY, [0, 100], ["1px solid rgba(255, 255, 255, 0)", "1px solid rgba(255, 255, 255, 0.05)"]);

  const scrollVelocity = useVelocity(scrollY);
  const scrollSkew = useTransform(scrollVelocity, [-2000, 2000], [-5, 5]);
  const scrollSkewSpring = useSpring(scrollSkew, { damping: 50, stiffness: 400 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16);
      cursorY.set(e.clientY - 16);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [cursorX, cursorY]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Auth Actions
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Login Error:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // Handle Video Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const storageRef = ref(storage, `projects/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        const sizes = ["small", "medium", "large"];
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        const title = file.name.split('.')[0];
        
        const docRef = await addDoc(collection(db, 'projects'), {
          title: title,
          type: "video",
          url: url,
          size: randomSize,
          description: "AI is crafting your case study...",
          createdAt: serverTimestamp(),
          authorUid: auth.currentUser?.uid
        });

        // AI Enhancement
        const description = await generateCaseStudy(title);
        // Update the doc with AI description
        await setDoc(doc(db, 'projects', docRef.id), { description }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'projects');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Remove Project
  const removeProject = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
  };

  const handleProjectEdit = (project: Project) => {
    if (!isAdmin) return;
    setEditingProject(project);
    setProjectForm({ 
      title: project.title, 
      description: project.description || '', 
      size: project.size || 'medium' 
    });
    setIsProjectModalOpen(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingProject) return;
    
    try {
      await setDoc(doc(db, 'projects', editingProject.id), {
        title: projectForm.title,
        description: projectForm.description,
        size: projectForm.size
      }, { merge: true });
      setIsProjectModalOpen(false);
      setEditingProject(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${editingProject.id}`);
    }
  };

  const handleReelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const storageRef = ref(storage, `reels/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        await addDoc(collection(db, 'reels'), {
          title: file.name.split('.')[0],
          url: url,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'reels');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeReel = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'reels', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reels/${id}`);
    }
  };

  const updateReelTitle = async (id: string, currentTitle: string) => {
    if (!isAdmin) return;
    const newTitle = prompt("New Reel Title:", currentTitle);
    if (newTitle && newTitle !== currentTitle) {
      try {
        await setDoc(doc(db, 'reels', id), { title: newTitle }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `reels/${id}`);
      }
    }
  };

  const handleReviewAdd = () => {
    if (!isAdmin) return;
    setEditingReview(null);
    setReviewForm({ name: '', role: '', text: '', pfp: '' });
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    const { name, role, text, pfp: formPfp } = reviewForm;
    const pfp = formPfp || `https://picsum.photos/seed/${name}/200/200`;
    
    if (name && text) {
      try {
        if (editingReview) {
          await setDoc(doc(db, 'reviews', editingReview.id), { 
            name, 
            role, 
            text, 
            pfp 
          }, { merge: true });
        } else {
          await addDoc(collection(db, 'reviews'), {
            name,
            role,
            text,
            pfp,
            createdAt: serverTimestamp()
          });
        }
        setIsReviewModalOpen(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, editingReview ? `reviews/${editingReview.id}` : 'reviews');
      }
    }
  };

  const removeReview = (id: string) => {
    if (!isAdmin) return;
    setReviewToDelete(id);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;
    try {
      await deleteDoc(doc(db, 'reviews', reviewToDelete));
      setReviewToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewToDelete}`);
    }
  };

  const updateReview = (id: string, currentReview: Review) => {
    if (!isAdmin) return;
    setEditingReview(currentReview);
    setReviewForm({ 
      name: currentReview.name, 
      role: currentReview.role || '', 
      text: currentReview.text,
      pfp: currentReview.pfp || ''
    });
    setIsReviewModalOpen(true);
  };

  const handleReviewPfpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const storageRef = ref(storage, `pfps/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        setReviewForm(prev => ({ ...prev, pfp: url }));
      } catch (error) {
        console.error("PFP Upload Error:", error);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const reelInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden relative">
      
      {/* ADMIN BAR */}
      {isAdmin && (
        <div className="fixed top-0 left-0 w-full z-[200] bg-purple-600 text-white py-2 px-8 flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.3em] shadow-lg">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2"><User size={12} /> Admin Mode</span>
            <div className="h-3 w-[1px] bg-white/30" />
            <button onClick={() => reelInputRef.current?.click()} className="hover:underline flex items-center gap-1">
              <Video size={12} /> Upload Reel
            </button>
            <button onClick={handleReviewAdd} className="hover:underline flex items-center gap-1">
              <MessageSquare size={12} /> Add Review
            </button>
          </div>
          <div className="flex gap-4">
            <span>{projects.length} Projects</span>
            <span>{reels.length} Reels</span>
            <span>{reviews.length} Reviews</span>
          </div>
          <input type="file" ref={reelInputRef} className="hidden" accept="video/*" onChange={handleReelUpload} />
        </div>
      )}

      {/* UPLOAD LOADING OVERLAY */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative">
              <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
              <div className="absolute inset-0 blur-xl bg-purple-500/20 animate-pulse" />
            </div>
            <h2 className="mt-8 text-2xl font-black tracking-tighter uppercase italic">
              Uploading <span className="text-purple-600">Assets</span>
            </h2>
            <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mt-2">Please wait while we secure your creative work</p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ATMOSPHERIC MESH BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <ParticleBackground />
        <motion.div 
          className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-br from-purple-600/10 via-blue-600/10 to-cyan-500/10 blur-[120px]"
          style={{ x: cursorXSpring, y: cursorYSpring, translateX: '-50%', translateY: '-50%' }}
        />
        <motion.div 
          style={{ y: bgMeshY1 }}
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/5 blur-[120px] rounded-full" 
        />
        <motion.div 
          style={{ y: bgMeshY2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/5 blur-[120px] rounded-full" 
        />
        <motion.div 
          style={{ y: bgMeshY3 }}
          className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-900/5 blur-[100px] rounded-full" 
        />
      </div>

      {/* 1. INTERACTIVE CURSOR - Hidden on mobile, optimized with springs */}
      <motion.div 
        className="fixed top-0 left-0 w-8 h-8 rounded-full border-2 border-purple-500 pointer-events-none z-[9999] mix-blend-difference hidden md:block"
        style={{ 
          x: cursorXSpring, 
          y: cursorYSpring,
        }}
        animate={{ 
          scale: isHovering ? 2.5 : 1,
          backgroundColor: isHovering ? "rgba(168, 85, 247, 0.5)" : "rgba(168, 85, 247, 0)",
          borderColor: isHovering ? "#06b6d4" : "#a855f7" // Shift to Cyan on hover
        }}
      />

      {/* SCROLL PROGRESS BAR */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-[2px] bg-purple-600 origin-left z-[1000]"
        style={{ scaleX: scrollYProgress }}
      />

      {/* 2. NAVIGATION */}
      <motion.nav 
        style={{ backgroundColor: navBg, backdropFilter: navBlur, borderBottom: navBorder }}
        className="p-8 flex justify-between items-center fixed top-0 left-0 w-full z-[100] transition-all duration-300"
      >
        <div className="text-2xl font-black tracking-tighter italic">
          3STACK.<span className="text-purple-600">MEDIA</span>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-8 text-xs uppercase tracking-[0.2em] font-medium">
            <a 
              href="#work" 
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('work');
              }}
              className="relative group py-2"
            >
              <span className="group-hover:text-purple-500 transition-colors">Work</span>
              <motion.span 
                className="absolute bottom-0 left-0 w-0 h-[1px] bg-purple-500"
                whileHover={{ width: '100%' }}
                transition={{ duration: 0.3 }}
              />
            </a>
            <a 
              href="#contact" 
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('contact');
              }}
              className="relative group py-2"
            >
              <span className="group-hover:text-purple-500 transition-colors">Contact</span>
              <motion.span 
                className="absolute bottom-0 left-0 w-0 h-[1px] bg-purple-500"
                whileHover={{ width: '100%' }}
                transition={{ duration: 0.3 }}
              />
            </a>
          </div>
          
          <div className="h-4 w-[1px] bg-white/10 hidden md:block" />

          {loading ? (
            <Loader2 size={18} className="animate-spin text-purple-500" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{isAdmin ? 'Admin' : 'Viewer'}</span>
                <span className="text-[10px] font-mono text-purple-500">{user.email?.split('@')[0]}</span>
              </div>
              <button 
                onClick={handleLogout}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-purple-500 transition-all"
            >
              <LogIn size={14} /> Login
            </button>
          )}
        </div>
      </motion.nav>

      {/* 3. HERO SECTION */}
      <header className="px-8 pt-20 pb-10 min-h-[80vh] flex flex-col items-center justify-center relative z-10">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity, y: heroY }}
          className="text-center"
        >
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-7xl md:text-9xl font-black mb-6 tracking-tighter group cursor-default"
          >
            <span className="relative inline-block">
              THE 
              <motion.span 
                className="absolute inset-0 text-purple-500/30 -z-10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                animate={{ x: [-2, 2, -1, 1, 0], y: [1, -1, 2, -2, 0] }}
                transition={{ repeat: Infinity, duration: 0.2 }}
              >THE</motion.span>
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-purple-700 relative inline-block ml-4">
              STACK.
              <motion.span 
                className="absolute inset-0 text-purple-400/20 -z-10 blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                animate={{ x: [2, -2, 1, -1, 0], y: [-1, 1, -2, 2, 0] }}
                transition={{ repeat: Infinity, duration: 0.15 }}
              >STACK.</motion.span>
            </span>
          </motion.h1>
        </motion.div>

        {/* SCROLL INDICATOR */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={() => scrollToSection('work')}
          className="absolute bottom-10 flex flex-col items-center gap-4 cursor-pointer group"
        >
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold group-hover:text-purple-500 transition-colors">Scroll to Explore</span>
          <div className="w-[1px] h-16 bg-gradient-to-b from-purple-500 to-transparent relative overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 w-full h-full bg-white"
              animate={{ y: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
          </div>
        </motion.div>
      </header>

      {/* REEL MARQUEE */}
      {reels.length > 0 ? (
        <ReelMarquee reels={reels} isAdmin={isAdmin} onRemove={removeReel} onEdit={updateReelTitle} />
      ) : isAdmin && (
        <section className="py-20 px-8 relative z-10 border-y border-white/5 bg-white/5">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <Video size={32} className="text-purple-500/40 mb-4" />
            <h3 className="text-xl font-bold italic mb-2">NO REELS YET</h3>
            <button onClick={() => reelInputRef.current?.click()} className="text-[10px] font-bold uppercase tracking-widest text-purple-500 hover:underline">Upload your first vertical reel</button>
          </div>
        </section>
      )}

      {/* 4. WORK SECTION (BENTO GRID) */}
      <section id="work" className="px-8 py-20 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">Selected <span className="text-purple-600">Works</span></h2>
          <p className="text-white/40 text-xs mt-2 tracking-widest uppercase">A collection of digital excellence</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[300px] gap-6">
          
          {/* THE UPLOAD SLOT - Only visible/functional for Admin */}
          {isAdmin && (
            <motion.div 
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onClick={() => fileInputRef.current?.click()}
              className="md:col-span-1 md:row-span-1 border-2 border-dashed border-purple-900/50 rounded-3xl flex flex-col items-center justify-center group cursor-pointer hover:border-purple-500 transition-all bg-purple-900/5 backdrop-blur-sm"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="video/*" 
                onChange={handleFileUpload}
              />
              <div className="p-6 rounded-full bg-purple-600/10 group-hover:bg-purple-600 group-hover:scale-110 transition-all">
                <Plus size={40} className="text-purple-500 group-hover:text-white" />
              </div>
              <p className="mt-4 text-purple-400 font-bold uppercase tracking-widest text-[10px]">Upload New Media</p>
            </motion.div>
          )}

          {/* PROJECT CARDS */}
          <AnimatePresence>
            {projects.map((project, index) => (
              <motion.div 
                key={project.id}
                layout
                style={{ skewY: scrollSkewSpring }}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, rotate: 0.5 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative group bg-[#111] rounded-3xl overflow-hidden border border-white/5 backdrop-blur-sm
                  ${project.size === 'large' ? 'md:col-span-2 md:row-span-2' : 
                    project.size === 'medium' ? 'md:col-span-2 md:row-span-1' : 
                    'md:col-span-1 md:row-span-1'}`}
              >
                <video 
                  src={project.url || FALLBACK_VIDEO} 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                  loop 
                  muted 
                  playsInline
                  onMouseOver={e => (e.target as HTMLVideoElement).play()} 
                  onMouseOut={e => (e.target as HTMLVideoElement).pause()}
                  onError={(e) => {
                    const target = e.target as HTMLVideoElement;
                    if (target.src !== FALLBACK_VIDEO) {
                      target.src = FALLBACK_VIDEO;
                    }
                  }}
                />
                <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                  <p className="text-[10px] text-purple-500 font-bold uppercase mb-1 tracking-widest">Case Study</p>
                  <div className="flex justify-between items-end">
                    <h3 className="text-xl font-bold tracking-tight group-hover:skew-x-2 transition-transform">{project.title}</h3>
                    {isAdmin && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProjectEdit(project);
                          }}
                          className="p-2 rounded-full bg-purple-500/10 hover:bg-purple-500 text-purple-500 hover:text-white transition-all"
                        >
                          <Edit2 size={14} />
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProject(project.id);
                          }}
                          className="p-2 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                      onClick={() => setSelectedProject(project)}
                      className="text-[10px] font-bold uppercase border-b border-cyan-500 hover:text-cyan-400 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {projects.length === 0 && !loading && !isAdmin && (
            <div className="col-span-full h-[400px] flex flex-col items-center justify-center text-center">
              <div className="p-8 rounded-full bg-white/5 mb-6">
                <MousePointer2 size={40} className="text-white/20" />
              </div>
              <h3 className="text-2xl font-bold italic mb-2">THE STACK IS EMPTY</h3>
              <p className="text-gray-500 text-sm max-w-xs">Waiting for the curator to upload new media assets.</p>
            </div>
          )}
        </div>
      </section>

      {/* CLIENT REVIEWS */}
      {reviews.length > 0 ? (
        <ClientReviews reviews={reviews} isAdmin={isAdmin} onRemove={removeReview} onAdd={handleReviewAdd} onEdit={updateReview} />
      ) : isAdmin && (
        <section className="py-20 px-8 relative z-10 border-y border-white/5">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <MessageSquare size={32} className="text-purple-500/40 mb-4" />
            <h3 className="text-xl font-bold italic mb-2">NO REVIEWS YET</h3>
            <button onClick={handleReviewAdd} className="text-[10px] font-bold uppercase tracking-widest text-purple-500 hover:underline">Add your first client review</button>
          </div>
        </section>
      )}

      {/* 5. CONTACT SECTION */}
      <section id="contact" className="px-8 py-32 bg-[#080808] border-t border-white/5 relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto relative z-10"
        >
          <h2 className="text-5xl font-bold mb-12 italic tracking-tighter">READY TO <span className="text-purple-600">STACK?</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <p className="text-gray-400 mb-8 text-lg leading-relaxed">We build digital experiences that move as fast as your brand does. Let's create something legendary together.</p>
              <div className="space-y-4">
                <div className="group cursor-pointer">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Email</p>
                  <p className="text-purple-500 font-mono text-lg group-hover:text-purple-400 transition-colors">hello@3stack.media</p>
                </div>
                <div className="group cursor-pointer">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Phone</p>
                  <p className="text-purple-500 font-mono text-lg group-hover:text-purple-400 transition-colors">+1 (555) 3-STACK</p>
                </div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-4"
            >
              <input type="text" placeholder="Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition-all hover:bg-white/10" />
              <input type="email" placeholder="Email" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition-all hover:bg-white/10" />
              <textarea placeholder="Message" rows={4} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition-all hover:bg-white/10"></textarea>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20"
              >
                SEND MESSAGE <Send size={18} />
              </motion.button>
            </motion.div>
          </div>
        </motion.div>

        {/* Decorative background element for contact section */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/5 blur-[150px] rounded-full pointer-events-none" />
      </section>

      {/* FOOTER */}
      <footer className="p-8 text-center text-gray-600 text-[10px] tracking-[0.3em] uppercase relative z-10">
        © 2024 3Stack.Media Group — All Rights Reserved
      </footer>

      {/* PROJECT DETAIL MODAL */}
      <AnimatePresence>
        {isReviewModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-8 bg-black/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-black tracking-tighter uppercase italic mb-6">
                {editingReview ? 'Edit' : 'Add'} <span className="text-purple-600">Review</span>
              </h2>
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Client Name</label>
                  <input 
                    type="text" 
                    value={reviewForm.name}
                    onChange={e => setReviewForm({ ...reviewForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Role / Company</label>
                  <input 
                    type="text" 
                    value={reviewForm.role}
                    onChange={e => setReviewForm({ ...reviewForm, role: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Review Text</label>
                  <textarea 
                    rows={4}
                    value={reviewForm.text}
                    onChange={e => setReviewForm({ ...reviewForm, text: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Profile Picture URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={reviewForm.pfp}
                      onChange={e => setReviewForm({ ...reviewForm, pfp: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition"
                    />
                    <button 
                      type="button"
                      onClick={() => reviewPfpInputRef.current?.click()}
                      className="px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition"
                      title="Upload Image"
                    >
                      <Plus size={18} />
                    </button>
                    <input 
                      type="file" 
                      ref={reviewPfpInputRef}
                      onChange={handleReviewPfpUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  {reviewForm.pfp && (
                    <div className="mt-4 flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                      <img src={reviewForm.pfp} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-purple-500/30" referrerPolicy="no-referrer" />
                      <span className="text-[10px] text-white/40 uppercase tracking-widest">Preview</span>
                      <button 
                        type="button" 
                        onClick={() => setReviewForm({ ...reviewForm, pfp: '' })}
                        className="ml-auto text-[10px] text-red-500 font-bold uppercase tracking-widest hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="flex-1 py-4 border border-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-purple-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-purple-500 transition"
                  >
                    {editingReview ? 'Update' : 'Save'} Review
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {reviewToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-red-500" size={24} />
              </div>
              <h2 className="text-xl font-bold mb-2">Delete Review?</h2>
              <p className="text-white/40 text-sm mb-8">This action cannot be undone. Are you sure you want to remove this client voice?</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setReviewToDelete(null)}
                  className="flex-1 py-4 border border-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteReview}
                  className="flex-1 py-4 bg-red-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 transition"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROJECT EDIT MODAL */}
      <AnimatePresence>
        {isProjectModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80 backdrop-blur-xl"
            onClick={() => setIsProjectModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-black tracking-tighter uppercase italic mb-6">
                Edit <span className="text-purple-600">Project</span>
              </h2>
              <form onSubmit={handleProjectSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Project Title</label>
                  <input 
                    type="text" 
                    value={projectForm.title}
                    onChange={e => setProjectForm({ ...projectForm, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Description / Case Study</label>
                  <textarea 
                    rows={6}
                    value={projectForm.description}
                    onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:outline-none focus:border-purple-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Grid Size</label>
                  <div className="flex gap-2">
                    {['small', 'medium', 'large'].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setProjectForm({ ...projectForm, size })}
                        className={`flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition
                          ${projectForm.size === size 
                            ? 'bg-purple-600 border-purple-500 text-white' 
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsProjectModalOpen(false)}
                    className="flex-1 py-4 border border-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-purple-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-purple-500 transition"
                  >
                    Update Project
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROJECT DETAIL MODAL */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-xl"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#111] border border-white/10 rounded-[40px] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl shadow-purple-500/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-full md:w-2/3 bg-black aspect-video md:aspect-auto">
                <CustomVideoPlayer src={selectedProject.url} />
              </div>
              <div className="w-full md:w-1/3 p-8 md:p-12 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-purple-500 font-bold uppercase mb-4 tracking-[0.3em]">Case Study / 0{projects.indexOf(selectedProject) + 1}</p>
                  <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight italic">{selectedProject.title}</h2>
                  <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
                    <div className="flex items-center gap-2 text-purple-500/80 text-[10px] uppercase font-bold tracking-widest mb-2">
                      <Sparkles size={12} /> AI Enhanced Case Study
                    </div>
                    <p>{selectedProject.description || "Analyzing project data... Our AI is generating a comprehensive case study for this media asset."}</p>
                    <div className="flex flex-wrap gap-2 pt-4">
                      {["Cinematic", "Cyber-Luxury", "4K Render"].map(tag => (
                        <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="mt-12 w-full py-4 border border-white/10 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all"
                >
                  Close Project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* SCROLL TO TOP BUTTON */}
      <AnimatePresence>
        {scrollY.get() > 500 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-10 right-10 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center z-[100] shadow-2xl shadow-purple-500/40 hover:bg-purple-500 transition-colors"
          >
            <motion.div
              animate={{ y: [2, -2, 2] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Plus className="rotate-45" size={24} />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
