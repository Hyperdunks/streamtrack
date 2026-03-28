import { Injectable, computed, signal, inject } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private api = inject(ApiService);
  private resolveInit?: () => void;
  private initPromise: Promise<void>;
  
  private currentUserSignal = signal<AuthUser | null>(null);
  private firebaseUserSignal = signal<FirebaseUser | null>(null);
  private isInitializedSignal = signal<boolean>(false);
  private authUnavailableSignal = signal<boolean>(false);
  
  currentUser = computed(() => this.currentUserSignal());
  isAuthenticated = computed(() => !!this.currentUserSignal());
  hasActiveSession = computed(() => !!this.firebaseUserSignal());
  isInitialized = computed(() => this.isInitializedSignal());
  isAuthUnavailable = computed(() => this.authUnavailableSignal());
  watchlistStorageKey = computed(() => this.firebaseUserSignal()?.uid || 'guest');

  constructor() {
    this.initPromise = new Promise((resolve) => {
      this.resolveInit = resolve;
    });

    // Initialize Firebase
    const app = getApps().length === 0 ? initializeApp(environment.firebase) : getApp();
    const auth = getAuth(app);

    // Listen to Firebase Auth state changes
    onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      this.firebaseUserSignal.set(user);
      this.currentUserSignal.set(null);
      this.authUnavailableSignal.set(false);

      try {
        if (user) {
          const res = await firstValueFrom(this.api.get<{ user: AuthUser }>('/auth/me'));
          if (res?.user) {
            this.currentUserSignal.set(res.user);
          }
        }
      } catch (error: unknown) {
        const status = typeof (error as { status?: unknown })?.status === 'number'
          ? (error as { status: number }).status
          : undefined;

        if (status === 503 || !error) {
          console.warn('Auth service unavailable, running in guest/browse-only mode');
          this.authUnavailableSignal.set(true);
        } else if (status !== 401) {
          console.error('Failed to fetch user from backend', error);
        }
      } finally {
        this.isInitialLoadDone = true;
        this.isInitializedSignal.set(true);
        this.resolveInit?.();
        this.resolveInit = undefined;
      }
    });
  }

  private isInitialLoadDone = false;
  async waitForInit(): Promise<void> {
    if (this.isInitialLoadDone) return;

    return this.initPromise;
  }

  async signup(payload: { name: string; email: string; password: string }): Promise<AuthUser> {
    const auth = getAuth();
    await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    
    // The authInterceptor will handle attaching the token to the request
    // But since the interceptor waits for getToken(), this will work contextually.
    const response = await firstValueFrom(this.api.post<{ user: AuthUser, message: string }>('/auth/register', {
      name: payload.name.trim()
    }));
    
    this.currentUserSignal.set(response.user);
    return response.user;
  }

  async login(payload: { email: string; password: string }): Promise<AuthUser> {
    const auth = getAuth();
    await signInWithEmailAndPassword(auth, payload.email, payload.password);
    
    const response = await firstValueFrom(this.api.post<{ user: AuthUser, message: string }>('/auth/login', {}));
    this.currentUserSignal.set(response.user);
    return response.user;
  }

  async loginWithGoogle(): Promise<AuthUser> {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    const { user } = await signInWithPopup(auth, provider);

    // Backend /auth/login auto-creates user if not found
    const response = await firstValueFrom(
      this.api.post<{ user: AuthUser; message: string }>('/auth/login', {
        name: user.displayName || '',
      })
    );
    this.currentUserSignal.set(response.user);
    return response.user;
  }

  async logout(): Promise<void> {
    const auth = getAuth();
    await signOut(auth);
    this.currentUserSignal.set(null);
  }

  async getToken(): Promise<string | null> {
    const user = getAuth().currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }
}
