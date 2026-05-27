export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: 'system' | 'safety' | 'social';
}

type NotificationListener = (notifications: AppNotification[]) => void;

export class NotificationService {
  private static instance: NotificationService;
  private notifications: AppNotification[] = [];
  private listeners: Set<NotificationListener> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public addListener(listener: NotificationListener) {
    this.listeners.add(listener);
    listener(this.getNotifications());
  }

  public removeListener(listener: NotificationListener) {
    this.listeners.delete(listener);
  }

  public getNotifications(): AppNotification[] {
    return [...this.notifications].sort((a, b) => b.timestamp - a.timestamp);
  }

  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  public pushNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      read: false,
    };
    
    this.notifications.push(newNotification);
    this.saveToStorage();
    this.notifyListeners();
  }

  public markAsRead(id: string) {
    const notif = this.notifications.find(n => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public markAllAsRead() {
    let changed = false;
    this.notifications.forEach(n => {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public clearAll() {
    this.notifications = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  private notifyListeners() {
    const notifs = this.getNotifications();
    this.listeners.forEach(listener => listener(notifs));
  }

  private saveToStorage() {
    try {
      localStorage.setItem('godive_notifications', JSON.stringify(this.notifications));
    } catch (e) {}
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('godive_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (e) {}
  }
}
