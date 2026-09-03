import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function apiServerPlugin() {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use('/api/send-email', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          return res.end();
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            const env = loadEnv(server.config.mode, process.cwd(), '');
            process.env.RESEND_API_KEY = env.RESEND_API_KEY || env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
            process.env.VITE_RESEND_API_KEY = env.VITE_RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
            process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

            // Import the serverless handler
            const { default: handler } = await import('./api/send-email.js');
            
            // Mock req & res for the Vercel handler
            const mockReq = {
              method: 'POST',
              body: parsed
            };
            const mockRes = {
              setHeader(k, v) { res.setHeader(k, v); },
              status(code) {
                res.statusCode = code;
                return {
                  json(data) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  },
                  end() { res.end(); }
                };
              }
            };

            await handler(mockReq, mockRes);
          } catch (err) {
            console.error('[Vite API Middleware Error]', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiServerPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});

