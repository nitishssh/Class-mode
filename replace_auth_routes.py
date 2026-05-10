import re

with open('server/routes.ts', 'r') as f:
    content = f.read()

# Replace import
import_statement = 'import authRouter from "./routes/auth";\n'
content = content.replace('import { createServer, type Server } from "http";', 'import { createServer, type Server } from "http";\n' + import_statement)

# Replace app.use
content = content.replace('  // Authentication routes (mostly handled by Firebase Client now)\n', '  // Authentication routes (mostly handled by Firebase Client now)\n  app.use("/api/auth", authRouter);\n')

lines = content.split('\n')

# Delete sync profile, login, me, register
del lines[206:425]

# delete firebase
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '  // POST /api/auth/firebase' in line:
        start_idx = i
    if start_idx != -1 and 'return res.status(500).json({ message: "Failed to authenticate with Firebase" });' in line:
        end_idx = i + 3
        break

if start_idx != -1 and end_idx != -1:
    del lines[start_idx:end_idx]


with open('server/routes.ts', 'w') as f:
    f.write('\n'.join(lines))
