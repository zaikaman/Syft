import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Shield, Zap, TrendingUp, Box, Users, 
  Activity, ShieldCheck, Layers, Sparkles
} from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useEffect, useMemo } from 'react';

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    
    const initUnicorn = () => {
      const UnicornStudio = (window as any).UnicornStudio;
      if (UnicornStudio && mounted) {
        try {
          UnicornStudio.init();
        } catch (error) {
          console.error('Error initializing UnicornStudio:', error);
        }
      }
    };

    // Check if UnicornStudio is already available
    if ((window as any).UnicornStudio) {
      initUnicorn();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="unicornstudio"]');
    if (existingScript) {
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if ((window as any).UnicornStudio) {
          clearInterval(checkLoaded);
          initUnicorn();
        }
      }, 50);
      
      return () => {
        clearInterval(checkLoaded);
        mounted = false;
      };
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js';
    script.async = true;
    
    script.onload = () => {
      setTimeout(initUnicorn, 100);
    };
    
    document.head.appendChild(script);

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => [
    { label: 'Total Value Locked', value: '$76M', change: '+12.5%', icon: TrendingUp },
    { label: 'Active Vaults', value: '600+', change: '+23.1%', icon: Box },
    { label: 'Total Users', value: '80K', change: '+8.3%', icon: Users },
    { label: 'Avg APY', value: '15.2%', change: '+2.1%', icon: Zap },
  ], []);

  const features = useMemo(() => [
    {
      icon: Box,
      title: 'Visual Vault Builder',
      description: 'Create sophisticated yield strategies with no code using our intuitive drag-and-drop interface.',
    },
    {
      icon: Zap,
      title: 'Automated Execution',
      description: 'Your vaults run 24/7, automatically executing strategies based on your configured rules.',
    },
    {
      icon: Shield,
      title: 'Security First',
      description: 'Built on Stellar with audited smart contracts and non-custodial architecture.',
    },
    {
      icon: TrendingUp,
      title: 'AI Optimization',
      description: 'Get AI-powered suggestions to optimize your vault performance and maximize yields.',
    },
  ], []);

  const platformFeatures = useMemo(() => [
    { icon: Activity, tag: 'Monitoring', title: 'Live tracking', color: 'text-primary-500' },
    { icon: ShieldCheck, tag: 'Security', title: 'Audited contracts', color: 'text-primary-500' },
    { icon: Layers, tag: 'Strategy', title: 'Multi-protocol', color: 'text-primary-500' },
    { icon: Sparkles, tag: 'AI', title: 'Smart optimization', color: 'text-primary-500' },
  ], []);

  const featureImageMap: Record<string, string> = useMemo(() => ({
    'Live tracking': '/live-tracking.png',
    'Audited contracts': '/audited-contracts.png',
    'Multi-protocol': '/multi-protocol.png',
    'Smart optimization': '/smart-optimization.png',
  }), []);

  const trustedBy = useMemo(() => [
    'Soroban Labs', 'Stellar Foundation', 'DeFi Alliance', 
    'Meridian Protocol', 'Anchor Platform', 'YieldSpace'
  ], []);

  const testimonials = useMemo(() => [
    {
      name: 'Alex Kim',
      handle: '@alexk_defi',
      initial: 'AK',
      color: 'from-[#dce85d] to-[#a8c93a]',
      text: 'Syft made vault creation incredibly simple. Deployed my first strategy in under 10 minutes with zero coding.',
    },
    {
      name: 'Sarah Martinez',
      handle: '@sarahm_yields',
      initial: 'SM',
      color: 'from-[#74b97f] to-[#5a9268]',
      text: 'The AI optimization suggestions have increased my vault\'s APY by 3%. Absolutely game-changing platform.',
    },
    {
      name: 'James Park',
      handle: '@jpark_stellar',
      initial: 'JP',
      color: 'from-[#a8c93a] to-[#8ba631]',
      text: 'Security audits and non-custodial design give me complete peace of mind. This is how DeFi should work.',
    },
    {
      name: 'Lisa Chen',
      handle: '@lisac_crypto',
      initial: 'LC',
      color: 'from-[#dce85d] to-[#c8d750]',
      text: 'Managing multiple vaults has never been easier. The dashboard is clean and the analytics are powerful.',
    },
    {
      name: 'Marcus Rivera',
      handle: '@mrivera_dev',
      initial: 'MR',
      color: 'from-[#a8c93a] to-[#8ba631]',
      text: 'The visual builder is intuitive and powerful. Created complex strategies without touching a single line of code.',
    },
    {
      name: 'Emma Nguyen',
      handle: '@emman_blockchain',
      initial: 'EN',
      color: 'from-[#74b97f] to-[#5a9268]',
      text: 'Real-time monitoring and automated rebalancing keep my vaults optimized. Best Stellar DeFi tool I\'ve used.',
    },
  ], []);

  const steps = useMemo(() => [
    {
      step: '01',
      title: 'Connect Wallet',
      description: 'Connect your Freighter or Albedo wallet in seconds',
    },
    {
      step: '02',
      title: 'Build Strategy',
      description: 'Use visual blocks to design your yield strategy',
    },
    {
      step: '03',
      title: 'Deploy & Earn',
      description: 'Deploy your vault and start earning automatically',
    },
  ], []);

  const duplicatedTestimonials = useMemo(() => {
    const row1 = testimonials.slice(0, 3);
    const row2 = testimonials.slice(3);
    return { row1, row2 };
  }, [testimonials]);

  useEffect(() => {
    Object.values(featureImageMap).forEach((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
  }, [featureImageMap]);

  return (
    <div className="min-h-screen bg-app">
      {/* Hero Section with Animated Background */}
      <section className="relative overflow-hidden py-24 md:py-32 bg-app">
        {/* UnicornStudio Animated Background */}
        <div 
          data-us-project="4gq2Yrv2p0bIa0hdLPQx" 
          className="absolute inset-0 w-full h-full"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
          }}
        />

        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold mb-4 text-white tracking-tight leading-[0.95]"
            >
              Build Smarter Vaults on{' '}
              <span className="text-[#dce85d]">Stellar</span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-[#a1a1aa] mb-8 max-w-2xl mx-auto"
            >
              Create, deploy, and manage automated yield strategies.
              No coding required. Maximum security. Optimal returns.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mb-16"
            >
              <Button
                size="lg"
                variant="primary"
                rightIcon={<ArrowRight size={18} />}
                onClick={() => navigate('/app/builder')}
              >
                Start Building
              </Button>
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label}>
                    <Card className="p-4 text-center bg-card hover:border-primary-500/30 transition-colors">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-primary-500" />
                        <div className="text-2xl font-bold text-neutral-50">
                          {stat.value}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-400 mb-1">{stat.label}</div>
                      <div className="text-xs text-success-500 font-medium">
                        {stat.change}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <p className="uppercase text-xs font-medium text-[#a1a1aa] tracking-wide">Trusted by teams at</p>
          </div>
          <div 
            className="overflow-hidden relative"
            style={{ 
              maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
            }}
          >
            <div className="flex gap-16 py-2 items-center animate-marquee">
              <div className="flex gap-16 shrink-0 items-center">
                {trustedBy.map((company, idx) => (
                  <span 
                    key={idx} 
                    className={`text-lg ${idx % 2 === 0 ? 'font-normal' : 'font-semibold'} tracking-tighter text-[#a1a1aa] hover:text-white transition whitespace-nowrap`}
                  >
                    {company}
                  </span>
                ))}
              </div>
              <div className="flex gap-16 shrink-0 items-center">
                {trustedBy.map((company, idx) => (
                  <span 
                    key={`dup-${idx}`} 
                    className={`text-lg ${idx % 2 === 0 ? 'font-normal' : 'font-semibold'} tracking-tighter text-[#a1a1aa] hover:text-white transition whitespace-nowrap`}
                  >
                    {company}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 relative bg-secondary">
        <div className="container mx-auto px-4 max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-3 text-white tracking-tight">
              Why Choose <span className="text-[#dce85d]">Syft</span>?
            </h2>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto">
              Everything you need to create and manage high-performance yield strategies
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title}>
                  <Card className="p-5 h-full bg-card hover:border-primary-500/30 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-primary-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-neutral-50">{feature.title}</h3>
                    <p className="text-sm text-[#a1a1aa] leading-relaxed">{feature.description}</p>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section className="py-16 relative bg-[#090a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="bg-[#16181a]/60 border border-white/[0.06] rounded-3xl p-6 sm:p-8 backdrop-blur">
            <div className="grid grid-cols-1 lg:grid-cols-2 sm:gap-10 gap-x-8 gap-y-8 items-start">
              <div className="flex flex-col min-h-full justify-between">
                <div>
                  <span className="text-sm font-normal text-[#a1a1aa]">Platform</span>
                  <h2 className="text-5xl sm:text-6xl lg:text-7xl leading-[0.9] text-white tracking-tighter mt-2">
                    A vault platform built for speed and precision.
                  </h2>
                  <div className="mt-8 relative">
                    <div className="flex flex-col gap-4 relative text-[#fafafa] pr-4 pl-4">
                      <div className="relative">
                        <div className="absolute left-2 top-8 bottom-0 w-px bg-gradient-to-b from-[#dce85d] via-[#a8c93a] to-[#74b97f]"></div>
                        <div className="flex gap-4 items-start">
                          <div className="flex-shrink-0 w-4 h-4 z-10 relative bg-[#090a0a] border-[#dce85d] border-2 rounded-full mt-0.5">
                            <div className="w-1.5 h-1.5 absolute top-0.5 left-0.5 bg-[#dce85d] rounded-full"></div>
                          </div>
                          <div className="flex-1 pb-6">
                            <span className="text-sm font-medium text-[#dce85d]">Smart Strategy Builder</span>
                            <p className="text-xs text-[#a1a1aa] mt-1">Visual interface for complex yield strategies</p>
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute left-2 top-8 bottom-0 w-px bg-gradient-to-b from-[#dce85d] via-[#a8c93a] to-[#74b97f]"></div>
                        <div className="flex gap-4 items-start">
                          <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-[#a8c93a] bg-[#090a0a] z-10 relative mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#a8c93a] absolute top-0.5 left-0.5"></div>
                          </div>
                          <div className="flex-1 pb-6">
                            <span className="text-sm font-medium text-[#a8c93a]">Real-time Analytics</span>
                            <p className="text-xs text-[#a1a1aa] mt-1">Monitor performance across all positions</p>
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-[#74b97f] bg-[#090a0a] z-10 relative mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#74b97f] absolute top-0.5 left-0.5"></div>
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium text-[#74b97f]">Gas Optimization</span>
                            <p className="text-xs text-[#a1a1aa] mt-1">Minimize fees with smart batching</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full mt-10">
                  <p className="text-sm font-medium text-white tracking-tight">Maximize every opportunity</p>
                  <p className="text-sm text-[#a1a1aa] mt-1 max-w-sm">
                    Advanced automation, risk management, and portfolio rebalancing that keeps your strategy optimized 24/7.
                  </p>
                  <Button
                    variant="primary"
                    className="mt-4"
                    onClick={() => navigate('/app/vaults')}
                  >
                    Explore vaults
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#090a0a] ml-2"></span>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 relative">
                {platformFeatures.map((feature, idx) => {
                  const Icon = feature.icon;
                  const bgImage = featureImageMap[feature.title];
                  return (
                    <div 
                      key={idx}
                      className={`relative overflow-hidden ${idx >= 2 ? 'aspect-[4/5]' : 'aspect-[4/3]'} bg-gradient-to-br from-neutral-800 to-neutral-900 bg-center bg-cover border border-white/[0.06] rounded-2xl`}
                      style={bgImage ? { backgroundImage: `url('${bgImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    >
                      <div className="bg-gradient-to-b from-black/0 via-black/15 to-black/60 absolute top-0 right-0 bottom-0 left-0"></div>
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-2 text-xs text-white/90 bg-white/10 border border-white/15 rounded-full py-1.5 px-1.5 backdrop-blur">
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-2 text-xs text-white/90 bg-white/10 border border-white/15 rounded-full py-1.5 px-3 backdrop-blur">
                          {feature.tag}
                        </span>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white text-lg font-medium tracking-tight leading-tight">{feature.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 relative bg-secondary">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-3 text-white tracking-tight">
              Get Started in <span className="text-[#dce85d]">3 Steps</span>
            </h2>
            <p className="text-lg text-[#a1a1aa]">
              From zero to earning in minutes
            </p>
          </motion.div>

          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.step}>
                <Card className="p-6 bg-card hover:border-primary-500/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-primary-500 flex items-center justify-center">
                        <span className="text-lg font-bold text-dark-950">{step.step}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1 text-neutral-50">{step.title}</h3>
                      <p className="text-base text-[#a1a1aa]">{step.description}</p>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-10"
          >
            <Button
              size="lg"
              variant="primary"
              rightIcon={<ArrowRight size={18} />}
              onClick={() => navigate('/app/builder')}
            >
              Create Your First Vault
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 lg:py-24 relative bg-[#090a0a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-[#a1a1aa]">What vault creators say</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tight font-semibold text-white">Testimonials</h2>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[#a1a1aa]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path>
                <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path>
              </svg>
              <span className="text-sm">Real feedback from builders</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl bg-[#0a0b0c] border border-white/[0.06] relative">
            <div 
              className="pointer-events-none absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-[#0a0b0c] to-transparent z-10"
            ></div>
            <div 
              className="pointer-events-none absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-[#0a0b0c] to-transparent z-10"
            ></div>
            
            {/* First Row */}
            <div className="py-6 sm:py-8 relative">
              <div className="flex gap-4 sm:gap-5 animate-marquee-ltr">
                {[...duplicatedTestimonials.row1, ...duplicatedTestimonials.row1].map((testimonial, idx) => (
                  <article 
                    key={`row1-${idx}`}
                    className="shrink-0 w-[280px] sm:w-[360px] md:w-[420px] rounded-2xl border border-white/[0.08] bg-[#16181a]/40 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-[#090a0a] font-semibold text-sm`}>
                        {testimonial.initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-white">{testimonial.name}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#dce85d]">
                            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
                            <path d="m9 12 2 2 4-4"></path>
                          </svg>
                        </div>
                        <p className="text-xs text-[#a1a1aa]">{testimonial.handle}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm sm:text-base text-[#fafafa]">
                      {testimonial.text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
            
            <div className="border-t border-white/[0.08]"></div>
            
            {/* Second Row */}
            <div className="py-6 sm:py-8 relative">
              <div className="flex gap-4 sm:gap-5 animate-marquee-rtl">
                {[...duplicatedTestimonials.row2, ...duplicatedTestimonials.row2].map((testimonial, idx) => (
                  <article 
                    key={`row2-${idx}`}
                    className="shrink-0 w-[280px] sm:w-[360px] md:w-[420px] rounded-2xl border border-white/[0.08] bg-[#16181a]/40 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-semibold text-sm`}>
                        {testimonial.initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-white">{testimonial.name}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#dce85d]">
                            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
                            <path d="m9 12 2 2 4-4"></path>
                          </svg>
                        </div>
                        <p className="text-xs text-[#a1a1aa]">{testimonial.handle}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm sm:text-base text-[#fafafa]">
                      {testimonial.text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 relative bg-secondary">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="p-10 md:p-12 text-center bg-[#1a1e21] border-primary-500/20">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight">
                Ready to <span className="text-[#dce85d]">Maximize</span> Your Yields?
              </h2>
              <p className="text-lg text-[#a1a1aa] mb-6 max-w-2xl mx-auto">
                Join thousands of users who are already earning with Syft's automated yield vaults
              </p>
              <Button
                size="lg"
                variant="primary"
                rightIcon={<ArrowRight size={18} />}
                onClick={() => navigate('/app/builder')}
              >
                Launch App
              </Button>
            </motion.div>
          </Card>
        </div>
      </section>
    </div>
  );
};

// Add type declaration for UnicornStudio
declare global {
  interface Window {
    UnicornStudio?: {
      init: () => void;
      isInitialized?: boolean;
    };
  }
}

export default Home;
