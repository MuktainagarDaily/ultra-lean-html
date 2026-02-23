import { Mail, Sparkles, Palette, Zap } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import aboutImage from "@/assets/about-image.jpg";

const features = [
  {
    icon: Sparkles,
    title: "Beautiful Design",
    description: "Crafted with care using modern design principles and warm aesthetics.",
  },
  {
    icon: Palette,
    title: "Custom Styling",
    description: "Every element is thoughtfully styled with a cohesive color palette.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized for speed and performance right out of the box.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <span className="font-heading text-2xl text-primary">MyStudio</span>
          <div className="flex gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <img
          src={heroImage}
          alt="Modern workspace bathed in warm golden light"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative z-10 text-center px-6 max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-heading text-primary-foreground mb-6 leading-tight">
            Create Something <span className="text-secondary">Beautiful</span>
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 font-body">
            A simple, elegant starting point for your next creative project. Designed with warmth and intention.
          </p>
          <a
            href="#features"
            className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Explore
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-heading text-center mb-4">
            Why You'll <span className="text-gradient">Love This</span>
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
            Everything you need to get started with a polished, modern web presence.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card rounded-xl border border-border p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading text-xl mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 px-6 bg-muted/50">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <img
            src={aboutImage}
            alt="Abstract geometric pattern"
            className="rounded-2xl shadow-xl w-full max-w-md mx-auto"
          />
          <div>
            <h2 className="text-4xl font-heading mb-6">
              About <span className="text-primary">Us</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We believe in the power of simplicity and thoughtful design. Every pixel matters, every interaction should feel natural, and every experience should bring joy.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This page is your canvas — a warm, inviting foundation built with modern tools. Make it yours and create something unforgettable.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-4xl font-heading mb-4">Get in Touch</h2>
          <p className="text-muted-foreground mb-8">
            Have a question or want to work together? We'd love to hear from you.
          </p>
          <a
            href="mailto:hello@example.com"
            className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-8 py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Mail className="w-4 h-4" />
            hello@example.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        &copy; 2026 MyStudio. All rights reserved.
      </footer>
    </div>
  );
};

export default Index;
