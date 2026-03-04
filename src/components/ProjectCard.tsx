import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight } from 'lucide-react';

type Status = 'Live' | 'Closed' | 'Upcoming';

interface ProjectCardProps {
  id: string;
  name: string;
  logo: string;
  status: Status;
  raisePercentage: number;
  description?: string;
  tokenSymbol?: string;
  targetRaise?: string;
}

const statusVariantMap: Record<Status, 'live' | 'closed' | 'upcoming'> = {
  Live: 'live',
  Closed: 'closed',
  Upcoming: 'upcoming',
};

const ProjectCard: React.FC<ProjectCardProps> = ({
  id,
  name,
  logo,
  status,
  raisePercentage,
  description = 'Next-generation decentralized protocol building the future of Web3 infrastructure.',
  tokenSymbol = 'TOKEN',
  targetRaise = '$500,000',
}) => {
  const circleRef = useRef<SVGCircleElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (circleRef.current && isVisible) {
      const offset = 283 - (283 * raisePercentage) / 100;
      circleRef.current.style.strokeDashoffset = String(offset);
    }
  }, [raisePercentage, isVisible]);

  const circumference = 2 * Math.PI * 45;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      className="project-card group"
    >
      <Link to={`/project/${id}`} className="block">
        {/* Card Header */}
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-4">
            {/* Project Logo */}
            <div className="w-14 h-14 rounded-2xl bg-canvas-alt border border-border flex items-center justify-center overflow-hidden">
              <img
                src={logo}
                alt={name}
                className="w-8 h-8 object-contain"
              />
            </div>
            <Badge variant={statusVariantMap[status]} pulse={status === 'Live'}>
              {status}
            </Badge>
          </div>

          {/* Project Info */}
          <div className="mb-4">
            <h3 className="font-display text-display-sm text-ink mb-2 group-hover:text-accent transition-colors duration-300">
              {name}
            </h3>
            <p className="text-body-sm text-ink-muted line-clamp-2">
              {description}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-border" />

        {/* Card Footer */}
        <div className="p-6 pt-4">
          <div className="flex items-center justify-between">
            {/* Progress Info */}
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono text-display-sm text-ink">
                  {raisePercentage}%
                </span>
                <span className="text-label text-ink-faint uppercase">
                  Raised
                </span>
              </div>
              <div className="flex items-center gap-3 text-body-sm text-ink-muted">
                <span>{tokenSymbol}</span>
                <span className="w-1 h-1 rounded-full bg-border-strong" />
                <span>{targetRaise}</span>
              </div>
            </div>

            {/* Progress Circle */}
            <div className="relative w-16 h-16">
              <svg
                className="w-full h-full progress-ring"
                viewBox="0 0 100 100"
              >
                <defs>
                  <linearGradient
                    id="progressGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#FF8A00" />
                    <stop offset="45%" stopColor="#FFB547" />
                    <stop offset="75%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#78C8FF" />
                  </linearGradient>
                  <filter id="progressGlow">
                    <feGaussianBlur stdDeviation="2" />
                  </filter>
                </defs>
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-canvas-alt"
                />
                {/* Glow ghost circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={isVisible ? 283 - (283 * raisePercentage) / 100 : circumference}
                  filter="url(#progressGlow)"
                  opacity="0.4"
                />
                {/* Progress circle */}
                <circle
                  ref={circleRef}
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference}
                  className="progress-ring__circle"
                />
              </svg>
            </div>
          </div>

          {/* View Project Link */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-body-sm text-ink-muted group-hover:text-ink transition-colors duration-300">
              View Details
            </span>
            <motion.div
              className="w-8 h-8 rounded-full bg-canvas-alt flex items-center justify-center group-hover:bg-ink group-hover:shadow-glow-orange transition-all duration-300"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowUpRight className="w-4 h-4 text-ink-muted group-hover:text-canvas transition-colors duration-300" />
            </motion.div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProjectCard;
