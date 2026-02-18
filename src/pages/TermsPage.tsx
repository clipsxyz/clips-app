import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm mb-8 inline-block">
          ← Back to Sign up
        </Link>

        <h1 className="text-2xl font-semibold text-white mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: February 2025</p>

        <nav className="mb-10 pb-6 border-b border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Contents</p>
          <ul className="space-y-2 text-sm">
            <li><a href="#introduction" className="text-blue-400 hover:underline">1. Introduction</a></li>
            <li><a href="#license" className="text-blue-400 hover:underline">2. License to Use</a></li>
            <li><a href="#acceptable-use" className="text-blue-400 hover:underline">3. Acceptable Use</a></li>
            <li><a href="#prohibited" className="text-blue-400 hover:underline">4. Prohibited Conduct</a></li>
            <li><a href="#user-content" className="text-blue-400 hover:underline">5. User-Generated Content</a></li>
            <li><a href="#termination" className="text-blue-400 hover:underline">6. Account Termination</a></li>
            <li><a href="#intellectual-property" className="text-blue-400 hover:underline">7. Intellectual Property</a></li>
            <li><a href="#privacy" className="text-blue-400 hover:underline">8. Privacy</a></li>
            <li><a href="#liability" className="text-blue-400 hover:underline">9. Limitation of Liability</a></li>
            <li><a href="#community-guidelines" className="text-blue-400 hover:underline">10. Community Guidelines</a></li>
            <li><a href="#changes" className="text-blue-400 hover:underline">11. Changes to Terms</a></li>
            <li><a href="#contact" className="text-blue-400 hover:underline">12. Contact</a></li>
          </ul>
        </nav>

        <div className="space-y-10 text-sm leading-relaxed">
          <section id="introduction">
            <h2 className="text-lg font-medium text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to Gazetteer. These Terms and Conditions (&quot;Terms&quot;) govern your use of our social media platform and related services. By creating an account or using our services, you agree to be bound by these Terms. If you do not agree, please do not use our platform.
            </p>
          </section>

          <section id="license">
            <h2 className="text-lg font-medium text-white mb-3">2. License to Use</h2>
            <p>
              We grant you a limited, non-exclusive, non-transferable license to access and use Gazetteer for personal, non-commercial purposes, subject to these Terms. You may not copy, modify, distribute, sell, or lease any part of our services without our prior written consent.
            </p>
          </section>

          <section id="acceptable-use">
            <h2 className="text-lg font-medium text-white mb-3">3. Acceptable Use</h2>
            <p>
              You agree to use Gazetteer in a lawful and respectful manner. You will share content that is appropriate for your community, respect other users, and comply with all applicable laws and regulations.
            </p>
          </section>

          <section id="prohibited">
            <h2 className="text-lg font-medium text-white mb-3">4. Prohibited Conduct</h2>
            <p className="mb-3">You may not:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-300">
              <li>Post content that is illegal, harmful, threatening, abusive, harassing, defamatory, or obscene</li>
              <li>Impersonate others or misrepresent your identity</li>
              <li>Spam, phish, or distribute malware</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Collect user data without consent</li>
              <li>Interfere with or disrupt our services</li>
              <li>Create multiple accounts to circumvent restrictions</li>
            </ul>
          </section>

          <section id="user-content">
            <h2 className="text-lg font-medium text-white mb-3">5. User-Generated Content</h2>
            <p>
              You retain ownership of content you post. By posting, you grant us a worldwide, royalty-free license to use, display, and distribute your content in connection with operating and promoting Gazetteer. We may remove content that violates these Terms or our Community Guidelines at our discretion.
            </p>
          </section>

          <section id="termination">
            <h2 className="text-lg font-medium text-white mb-3">6. Account Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these Terms. You may delete your account at any time through your profile settings. Upon termination, your right to use our services ceases immediately.
            </p>
          </section>

          <section id="intellectual-property">
            <h2 className="text-lg font-medium text-white mb-3">7. Intellectual Property</h2>
            <p>
              Gazetteer, our logos, and all related trademarks and content are owned by us. You may not use our branding or intellectual property without our written permission.
            </p>
          </section>

          <section id="privacy">
            <h2 className="text-lg font-medium text-white mb-3">8. Privacy</h2>
            <p>
              Your use of Gazetteer is also governed by our Privacy Policy. We collect and process data as described there. By using our services, you consent to our data practices.
            </p>
          </section>

          <section id="liability">
            <h2 className="text-lg font-medium text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Gazetteer is provided &quot;as is&quot; without warranties of any kind. We are not liable for any indirect, incidental, special, or consequential damages arising from your use of our services. Our total liability shall not exceed the amount you paid us in the past 12 months, if any.
            </p>
          </section>

          <section id="community-guidelines">
            <h2 className="text-lg font-medium text-white mb-3">10. Community Guidelines</h2>
            <p className="mb-3">Our community is built on respect and local connection. Please:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-300">
              <li>Be respectful and constructive in your interactions</li>
              <li>Share accurate, relevant information for your location</li>
              <li>Report content that violates our guidelines</li>
              <li>Protect your privacy and the privacy of others</li>
              <li>Support a positive, inclusive environment</li>
            </ul>
          </section>

          <section id="changes">
            <h2 className="text-lg font-medium text-white mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes via email or in-app notice. Continued use after changes constitutes acceptance. If you do not agree, you must stop using our services.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-lg font-medium text-white mb-3">12. Contact</h2>
            <p>
              For questions about these Terms, please contact us at support@gazetteer.app or through the in-app help center.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700">
          <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Back to Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
