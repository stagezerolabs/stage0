import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Clock,
  Globe,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { projects } from '@/lib/projects';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const ProjectPage: React.FC = () => {
  const { address } = useParams();
  const [amount, setAmount] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [address]);

  const project = projects.find((p) => p.address === address);

  if (!project) {
    return (
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center justify-center min-h-[60vh] text-center"
      >
        <div className="w-20 h-20 rounded-full bg-canvas-alt flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-status-error" />
        </div>
        <h1 className="font-display text-display-md text-ink mb-4">
          Project Not Found
        </h1>
        <p className="text-body text-ink-muted max-w-md mb-8">
          The project you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </motion.div>
    );
  }

  const badgeVariant = project.status === 'Live' ? 'live' : project.status === 'Upcoming' ? 'upcoming' : 'default';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      {/* Back Button */}
      <motion.div variants={itemVariants}>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </motion.div>

      {/* Project Header & Details */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row gap-8 lg:gap-16">
        {/* Left Column */}
        <div className="flex-1 space-y-12">
          {/* Project Info */}
          <div className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-2xl bg-canvas-alt border border-border flex items-center justify-center flex-shrink-0">
                <img src={`https://api.dicebear.com/9.x/identicon/svg?seed=${project.name}`} alt={project.name} className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-display-lg text-ink">
                    {project.name}
                  </h1>
                  <Badge variant={badgeVariant} pulse={project.status === 'Live'}>
                    {project.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-body-sm text-ink-muted">
                  <span className="font-mono">{project.symbol}</span>
                  <span className="w-1 h-1 rounded-full bg-border-strong" />
                  <span>{project.chain}</span>
                </div>
              </div>
            </div>

            <p className="text-body text-ink-muted leading-relaxed">
              {project.description}
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href={project.links.website}
                className="w-10 h-10 rounded-full bg-canvas-alt flex items-center justify-center text-ink-muted hover:bg-ink hover:text-canvas transition-all duration-300"
              >
                <Globe className="w-4 h-4" />
              </a>
              <a
                href={project.links.twitter}
                className="w-10 h-10 rounded-full bg-canvas-alt flex items-center justify-center text-ink-muted hover:bg-ink hover:text-canvas transition-all duration-300"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={project.links.whitepaper}
                className="w-10 h-10 rounded-full bg-canvas-alt flex items-center justify-center text-ink-muted hover:bg-ink hover:text-canvas transition-all duration-300"
              >
                <FileText className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Token Details */}
          <div className="bg-canvas-alt rounded-3xl border border-border p-8 space-y-6">
            <h2 className="font-display text-display-sm text-ink">Token Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-body-sm text-ink-muted">Token Symbol</span>
                  <span className="font-mono text-body-sm text-ink">{project.symbol}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-body-sm text-ink-muted">Token Price</span>
                  <span className="font-mono text-body-sm text-ink">{project.tokenPrice}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-body-sm text-ink-muted">Network</span>
                  <span className="text-body-sm text-ink">{project.chain}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-body-sm text-ink-muted">Vesting Schedule</span>
                  <span className="text-body-sm text-ink">{project.vesting}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-body-sm text-ink-muted">Start Date</span>
                  <span className="text-body-sm text-ink">{project.startDate}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-body-sm text-ink-muted">End Date</span>
                  <span className="text-body-sm text-ink">{project.endDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Participation Card */}
        <div className="lg:w-[420px]">
          <div className="bg-canvas-alt rounded-3xl border border-border p-8 space-y-6">
            {/* Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-ink-muted">Progress</span>
                <span className="font-mono text-ink">{project.raisePercentage}%</span>
              </div>
              <div className="h-2 bg-canvas-alt rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${project.raisePercentage}%` }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                  className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full"
                />
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-ink-muted">
                  <span className="font-mono text-ink">{project.raised}</span> raised
                </span>
                <span className="text-ink-faint">of {project.targetRaise}</span>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Timer */}
            <div className="flex items-center gap-3 text-body-sm">
              <Clock className="w-4 h-4 text-ink-faint" />
              <span className="text-ink-muted">
                Ends <span className="text-ink">{project.endDate}</span>
              </span>
            </div>

            {/* Input */}
            <div className="space-y-2">
              <label className="text-label text-ink-faint uppercase">
                Contribution Amount
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-field font-mono pr-20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-body-sm text-ink-muted">
                  USDC
                </span>
              </div>
              <div className="flex items-center justify-between text-body-sm text-ink-faint">
                <span>Min: {project.minAllocation}</span>
                <span>Max: {project.maxAllocation}</span>
              </div>
            </div>

            <button className="btn-primary w-full" disabled={project.status !== 'Live'}>
              {project.status === 'Live' ? 'Participate Now' : `Sale ${project.status}`}
            </button>

            <p className="text-body-sm text-ink-faint text-center">
              By participating, you agree to our terms and conditions.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProjectPage;
