const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold text-primary">My Website</h1>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <section className="mb-12">
          <h2 className="mb-4 text-3xl font-bold">Welcome</h2>
          <p className="text-lg text-muted-foreground">
            This is a simple HTML page. Edit it to start building your website.
          </p>
        </section>

        <section className="mb-12">
          <h3 className="mb-3 text-xl font-semibold">About</h3>
          <p className="text-muted-foreground">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </section>

        <section>
          <h3 className="mb-3 text-xl font-semibold">Contact</h3>
          <p className="text-muted-foreground">
            Email: <a href="mailto:hello@example.com" className="text-primary underline">hello@example.com</a>
          </p>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
        &copy; 2026 My Website. All rights reserved.
      </footer>
    </div>
  );
};

export default Index;
