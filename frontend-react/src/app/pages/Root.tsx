import { Outlet, Link } from "react-router";
import { ChatBot } from "../components/ChatBot";

export function Root() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center">
              <span className="text-primary-foreground text-base" style={{ fontFamily: "'Press Start 2P', monospace" }}>E</span>
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="font-bold text-xl tracking-tight">EDUPRIME</span>
              <span className="text-xs text-muted-foreground tracking-widest">UNIVERSITY</span>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/academics" className="text-sm hover:text-primary transition-colors">Academics</Link>
            <Link to="/course-catalog" className="text-sm hover:text-primary transition-colors">Course Catalog</Link>
            <Link to="/admissions" className="text-sm hover:text-primary transition-colors">Admissions</Link>
            <Link to="/research" className="text-sm hover:text-primary transition-colors">Research</Link>
            <Link to="/campus-life" className="text-sm hover:text-primary transition-colors">Campus Life</Link>
            <Link to="/my-page" className="text-sm hover:text-primary transition-colors">My Page</Link>
          </div>
        </div>
      </nav>

      <Outlet />
      <ChatBot />

      {/* Footer */}
      <footer className="border-t py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center">
                  <span className="text-primary-foreground text-sm" style={{ fontFamily: "'Press Start 2P', monospace" }}>E</span>
                </div>
                <div className="flex flex-col -space-y-1">
                  <span className="font-bold text-lg tracking-tight">EDUPRIME</span>
                  <span className="text-xs text-muted-foreground tracking-widest">UNIVERSITY</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                1876 Academic Way<br/>
                Cambridge, MA 02138<br/>
                United States
              </p>
              <p className="text-sm text-muted-foreground">
                Phone: +1 (617) 555-1000
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Academics</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/academics" className="hover:text-foreground">Programs</Link></li>
                <li><a href="#" className="hover:text-foreground">Departments</a></li>
                <li><a href="#" className="hover:text-foreground">Research</a></li>
                <li><a href="#" className="hover:text-foreground">Libraries</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Admissions</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Undergraduate</a></li>
                <li><a href="#" className="hover:text-foreground">Graduate</a></li>
                <li><a href="#" className="hover:text-foreground">International</a></li>
                <li><a href="#" className="hover:text-foreground">Financial Aid</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">About</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Leadership</a></li>
                <li><a href="#" className="hover:text-foreground">History</a></li>
                <li><a href="#" className="hover:text-foreground">News & Events</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-muted-foreground">
                © 2026 EduPrime University. All rights reserved. <span className="text-xs opacity-70" style={{ fontFamily: "'Press Start 2P', monospace" }}>v2.0</span>
              </div>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground">Privacy Policy</a>
                <a href="#" className="hover:text-foreground">Terms of Use</a>
                <a href="#" className="hover:text-foreground">Accessibility</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
