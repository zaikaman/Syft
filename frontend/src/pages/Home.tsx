import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Zap, TrendingUp, Box, Users } from 'lucide-react';
import { Button, Card } from '../components/ui';

const Home = () => {
  const navigate = useNavigate();

  const stats = [
    { label: 'Total Value Locked', value: '$76M', change: '+12.5%', icon: TrendingUp },
    { label: 'Active Vaults', value: '600+', change: '+23.1%', icon: Box },
    { label: 'Total Users', value: '80K', change: '+8.3%', icon: Users },
    { label: 'Avg APY', value: '15.2%', change: '+2.1%', icon: Zap },
  ];

  const features = [
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
  ];

  const steps = [
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
  ];

  return (
    <div className="min-h-screen bg-app">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-6xl">
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
              className="text-4xl md:text-6xl font-bold mb-4 text-neutral-50"
            >
              Build Smarter Vaults on{' '}
              <span className="text-primary-500">Stellar</span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-neutral-400 mb-8 max-w-2xl mx-auto"
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
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <Card className="p-4 text-center bg-card">
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
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 relative bg-secondary">
        <div className="container mx-auto px-4 max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-neutral-50">
              Why Choose <span className="text-primary-500">Syft</span>?
            </h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Everything you need to create and manage high-performance yield strategies
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-5 h-full bg-card" hover>
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-primary-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-neutral-50">{feature.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{feature.description}</p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 relative">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-neutral-50">
              Get Started in <span className="text-primary-500">3 Steps</span>
            </h2>
            <p className="text-lg text-neutral-400">
              From zero to earning in minutes
            </p>
          </motion.div>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 bg-card" hover>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-primary-500 flex items-center justify-center">
                        <span className="text-lg font-bold text-dark-950">{step.step}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1 text-neutral-50">{step.title}</h3>
                      <p className="text-base text-neutral-400">{step.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
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

      {/* CTA Section */}
      <section className="py-16 relative">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="p-10 md:p-12 text-center bg-neutral-900 border-primary-500/20">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-neutral-50">
                Ready to <span className="text-primary-500">Maximize</span> Your Yields?
              </h2>
              <p className="text-lg text-neutral-400 mb-6 max-w-2xl mx-auto">
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

export default Home;
