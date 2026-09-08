import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

const PORT = parseInt(process.env.DEMO_BANK_PORT || '3000', 10);

interface Member {
  id: string;
  name: string;
  email: string;
  accounts: {
    checking: number;
    savings: number;
  };
}

const members: Map<string, Member> = new Map([
  ['12345', {
    id: '12345',
    name: 'John Anderson',
    email: 'john.anderson@example.com',
    accounts: {
      checking: 2500.00,
      savings: 15000.00
    }
  }],
  ['67890', {
    id: '67890',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    accounts: {
      checking: 1200.50,
      savings: 8500.25
    }
  }]
]);

function htmlPage(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Demo Bank - Member Portal</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    .label { font-weight: bold; color: #555; width: 40%; }
    .value { color: #333; }
    input[type="text"] { padding: 8px; width: 200px; border: 1px solid #ddd; border-radius: 4px; }
    button { padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #2980b9; }
    .error { color: #e74c3c; padding: 10px; background: #fadbd8; border-radius: 4px; margin: 10px 0; }
    .success { color: #27ae60; padding: 10px; background: #d5f4e6; border-radius: 4px; margin: 10px 0; }
    form { margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
</body>
</html>`;
}

function searchPage(error?: string): string {
  return htmlPage(`
    <h1>Demo Bank Member Portal</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="GET" action="/member">
      <table>
        <tr>
          <td class="label">Member ID:</td>
          <td class="value">
            <input type="text" name="id" placeholder="Enter member ID" />
          </td>
        </tr>
        <tr>
          <td></td>
          <td class="value">
            <button type="submit">Search Member</button>
          </td>
        </tr>
      </table>
    </form>
  `);
}

function memberDetailPage(member: Member): string {
  return htmlPage(`
    <h1>Member Details</h1>
    <div class="success">Member found</div>
    <table>
      <tr>
        <td class="label">Member ID:</td>
        <td class="value">${member.id}</td>
      </tr>
      <tr>
        <td class="label">Full Name:</td>
        <td class="value">${member.name}</td>
      </tr>
      <tr>
        <td class="label">Email Address:</td>
        <td class="value">${member.email}</td>
      </tr>
      <tr>
        <td class="label">Checking Balance:</td>
        <td class="value">$${member.accounts.checking.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="label">Savings Balance:</td>
        <td class="value">$${member.accounts.savings.toFixed(2)}</td>
      </tr>
    </table>
    <form method="GET" action="/">
      <button type="submit">Back to Search</button>
    </form>
  `);
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(searchPage());
    return;
  }
  
  if (url.pathname === '/member') {
    const memberId = url.searchParams.get('id');
    
    if (!memberId) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(searchPage('Please enter a member ID'));
      return;
    }
    
    const member = members.get(memberId);
    
    if (!member) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(searchPage('Member record not found'));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(memberDetailPage(member));
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(htmlPage('<h1>404 - Not Found</h1>'));
}

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Demo Bank running at http://localhost:${PORT}`);
  console.log(`Test member IDs: 12345, 67890`);
});
