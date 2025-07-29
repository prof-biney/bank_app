import { router } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronUp, Mail } from "lucide-react-native";
import React, { useState } from "react";
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: "1",
    question: "How do I transfer money to another account?",
    answer:
      'To transfer money, go to the Home screen and tap "Transfer". Select your card, choose a recipient, enter the amount, and confirm the transfer.',
  },
  {
    id: "2",
    question: "Is my money safe with this app?",
    answer:
      "Yes, we use bank-level security with 256-bit encryption. Your funds are FDIC insured up to $250,000 and we never store your sensitive information.",
  },
  {
    id: "3",
    question: "How do I add a new card to my account?",
    answer:
      "Currently, new cards are added through our customer service. Please contact support@yourbankapp.com to add additional cards to your account.",
  },
  {
    id: "4",
    question: "What should I do if I notice unauthorized transactions?",
    answer:
      "Immediately contact our support team at support@yourbankapp.com or call our 24/7 fraud hotline. We will freeze your account and investigate the transactions.",
  },
  {
    id: "5",
    question: "How do I change my PIN or password?",
    answer:
      "You can change your password in the Profile > Settings section. For PIN changes, please contact customer support for security verification.",
  },
];

export default function HelpSupportScreen() {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleEmailSupport = () => {
    Linking.openURL(
      "mailto:support@yourbankapp.com?subject=Banking App Support"
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Need immediate help?</Text>
          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleEmailSupport}
          >
            <Mail color="#0F766E" size={20} />
            <Text style={styles.emailText}>support@yourbankapp.com</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          {faqs.map((faq) => (
            <View key={faq.id} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleFAQ(faq.id)}
              >
                <Text style={styles.questionText}>{faq.question}</Text>
                {expandedFAQ === faq.id ? (
                  <ChevronUp color="#6B7280" size={20} />
                ) : (
                  <ChevronDown color="#6B7280" size={20} />
                )}
              </TouchableOpacity>

              {expandedFAQ === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.answerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contactSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emailText: {
    fontSize: 16,
    color: "#0F766E",
    fontWeight: "500",
    marginLeft: 8,
  },
  faqSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 16,
    marginBottom: 16,
  },
  faqQuestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  questionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F9FAFB",
  },
  answerText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
});
