import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Shield, Zap, TrendingUp, Box, Users } from 'lucide-react';
import { Button, Card, GradientText } from '../components/ui';

const Home = () => {
  const navigate = useNavigate();

  const stats = [
    { label: '24h Trading Volume', value: '$76B', change: '+12.5%', icon: TrendingUp },
    { label: 'Active Vaults', value: '600+', change: '+23.1%', icon: Box },
    { label: 'Total Users', value: '80M', change: '+8.3%', icon: Users },
    { label: 'Avg APY', value: '15.2%', change: '+2.1%', icon: Zap },
  ];

  const features = [
    {
      icon: Box,
      title: 'Visual Vault Builder',
      description: 'Create sophisticated yield strategies with no code using our intuitive drag-and-drop interface.',
      gradient: 'from-purple-600 to-blue-600',
    },
    {
      icon: Zap,
      title: 'Automated Execution',
      description: 'Your vaults run 24/7, automatically executing strategies based on your configured rules.',
      gradient: 'from-blue-600 to-cyan-600',
    },
    {
      icon: Shield,
      title: 'Security First',
      description: 'Built on Stellar with audited smart contracts and non-custodial architecture.',
      gradient: 'from-pink-600 to-purple-600',
    },
    {
      icon: TrendingUp,
      title: 'AI Optimization',
      description: 'Get AI-powered suggestions to optimize your vault performance and maximize yields.',
      gradient: 'from-orange-600 to-pink-600',
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
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] animate-pulse delay-1000" />
        </div>

        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/10 border border-purple-500/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">The Future of DeFi Yield Vaults</span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              The most{' '}
              <GradientText>secure</GradientText>
              <br />
              crypto yield{' '}
              <GradientText variant="secondary">vault</GradientText>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-gray-400 mb-12 max-w-3xl mx-auto"
            >
              Build, deploy, and manage automated yield strategies on Stellar.
              No coding required. Maximum security. Optimal returns.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="xl"
                variant="gradient"
                rightIcon={<ArrowRight />}
                onClick={() => navigate('/builder')}
              >
                Start Building
              </Button>
              <Button
                size="xl"
                variant="outline"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                  >
                    <Card className="p-6 text-center" hover glow>
                      <div className="flex justify-center mb-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold mb-1">
                        <GradientText>{stat.value}</GradientText>
                      </div>
                      <div className="text-sm text-gray-400 mb-2">{stat.label}</div>
                      <div className="text-xs text-green-400 font-medium">
                        ↑ {stat.change}
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
      <section id="features" className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Choose <GradientText>Syft</GradientText>?
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to create and manage high-performance yield strategies
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-6 h-full" hover>
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Get Started in <GradientText variant="secondary">3 Steps</GradientText>
            </h2>
            <p className="text-xl text-gray-400">
              From zero to earning in minutes
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="relative"
              >
                <div className="flex items-start gap-6 mb-12">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
                      <span className="text-2xl font-bold text-white">{step.step}</span>
                    </div>
                  </div>
                  <div className="flex-1 pt-2">
                    <h3 className="text-2xl font-bold mb-2 text-white">{step.title}</h3>
                    <p className="text-lg text-gray-400">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="absolute left-10 top-20 bottom-0 w-0.5 bg-gradient-to-b from-purple-600 to-transparent" />
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button
              size="xl"
              variant="gradient"
              rightIcon={<ArrowRight />}
              onClick={() => navigate('/builder')}
            >
              Create Your First Vault
            </Button>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <Card gradient className="p-12 md:p-16 text-center relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/30 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/30 rounded-full blur-[100px]" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to <GradientText>Maximize</GradientText> Your Yields?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of users who are already earning with Syft's automated yield vaults
              </p>
              <Button
                size="xl"
                variant="primary"
                rightIcon={<ArrowRight />}
                onClick={() => navigate('/builder')}
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
